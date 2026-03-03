// STM TLS cartoon (p5.js) — synced position and energy views
//
// Controls:
// - detuning δ = ωd - ωTLS  (cartoon units)
// - drive amplitude A
// - base bias ε0
// - well separation Δ (distance between minima)
// - tunneling coupling t  (Hamiltonian off-diagonal)
// - barrier height V0 (visual)
//
// Key change for syncing:
// - We define |g>,|e> from the STATIC Hamiltonian at ε = ε0 (no drive).
// - We always compute Pe(t)=|<e|ψ(t)>|^2 from the SAME state ψ(t) used for blobs.
//   This keeps the two panels visually synchronized.

let ui = {};
let tls;

function setup() {
  createCanvas(1100, 620);
  pixelDensity(2);
  textFont("system-ui");

  tls = new TLS();

  ui.mode = 2; // 0 pos, 1 energy, 2 both
  ui.btnPos  = new Button(20, 18, 140, 34, "Position", () => ui.mode = 0);
  ui.btnEng  = new Button(170, 18, 140, 34, "Energy",   () => ui.mode = 1);
  ui.btnBoth = new Button(320, 18, 110, 34, "Both",     () => ui.mode = 2);

  ui.pause = false;
  ui.btnPause = new Button(450, 18, 110, 34, "Pause", () => ui.pause = !ui.pause);

  // ---- Defaults tuned for clean oscillations ----
  // Set detuning ~ 0, moderate A, moderate t.
  ui.sDet  = new LabeledSlider(600, 14, 230, "Detuning  δ=ωd-ωTLS", -2.0, 2.0, 0.00, 0.01);
  ui.sA    = new LabeledSlider(860, 14, 210, "Drive amplitude  A", 0.0, 1.5, 0.75, 0.01);

  ui.seps0 = new LabeledSlider(600, 54, 230, "Base bias  ε0", -1.2, 1.2, 0.10, 0.01);

  // Δ = distance between wells (visual geometry)
  ui.sSep  = new LabeledSlider(860, 54, 210, "Well separation  Δ", 0.6, 2.2, 1.40, 0.01);

  // t = tunneling coupling in Hamiltonian
  ui.stun  = new LabeledSlider(600, 94, 230, "Tunneling  t", 0.0, 2.0, 0.85, 0.01);

  // visual barrier
  ui.sV0   = new LabeledSlider(860, 94, 210, "Barrier height  V0", 0.4, 2.2, 1.10, 0.01);
}

function draw() {
  background(248);

  const topH = 135;
  const pad = 18;
  const x0 = pad;
  const y0 = topH + pad;
  const w0 = width - 2 * pad;
  const h0 = height - y0 - pad;

  // UI
  ui.btnPos.setActive(ui.mode === 0);
  ui.btnEng.setActive(ui.mode === 1);
  ui.btnBoth.setActive(ui.mode === 2);
  ui.btnPause.setActive(ui.pause);

  ui.btnPos.draw(); ui.btnEng.draw(); ui.btnBoth.draw(); ui.btnPause.draw();
  ui.sDet.draw(); ui.sA.draw(); ui.seps0.draw(); ui.sSep.draw(); ui.stun.draw(); ui.sV0.draw();

  const p = {
    det: ui.sDet.val(),   // δ = ωd - ωTLS
    A: ui.sA.val(),
    eps0: ui.seps0.val(),
    sep: ui.sSep.val(),
    t: ui.stun.val(),
    V0: ui.sV0.val()
  };

  // stable step
  let dt = min(0.02, deltaTime / 1000);
  if (ui.pause) dt = 0;
  tls.step(dt, p);

  // panels
  if (ui.mode === 0 || ui.mode === 1) {
    drawPanel(x0, y0, w0, h0);
    if (ui.mode === 0) drawPositionPanel(x0, y0, w0, h0, tls, p);
    else drawEnergyPanel(x0, y0, w0, h0, tls, p);
  } else {
    const gap = 18;
    const w = (w0 - gap) / 2;
    drawPanel(x0, y0, w, h0);
    drawPanel(x0 + w + gap, y0, w, h0);
    drawPositionPanel(x0, y0, w, h0, tls, p);
    drawEnergyPanel(x0 + w + gap, y0, w, h0, tls, p);
  }
}

function mousePressed() {
  ui.btnPos.mousePressed();
  ui.btnEng.mousePressed();
  ui.btnBoth.mousePressed();
  ui.btnPause.mousePressed();
}

// -------------------- UI --------------------
class Button {
  constructor(x, y, w, h, label, onClick) {
    this.x=x; this.y=y; this.w=w; this.h=h;
    this.label=label; this.onClick=onClick;
    this.active=false;
  }
  setActive(v){ this.active=v; }
  hit(mx,my){ return mx>=this.x && mx<=this.x+this.w && my>=this.y && my<=this.y+this.h; }
  draw(){
    const hover = this.hit(mouseX, mouseY);
    const bg = this.active ? 238 : (hover ? 246 : 252);
    fill(bg);
    stroke(0,0,0, this.active ? 85 : 25);
    strokeWeight(this.active ? 2.2 : 1);
    rect(this.x, this.y, this.w, this.h, 12);
    noStroke();
    fill(18);
    textSize(13);
    textAlign(CENTER, CENTER);
    text(this.label, this.x+this.w/2, this.y+this.h/2);
  }
  mousePressed(){ if(this.hit(mouseX, mouseY)) this.onClick(); }
}

class LabeledSlider {
  constructor(x,y,w,label,minV,maxV,initV,stepV){
    this.x=x; this.y=y; this.w=w; this.label=label;
    this.s = createSlider(minV, maxV, initV, stepV);
    this.s.position(x, y+18);
    this.s.style("width", w+"px");
  }
  draw(){
    noStroke();
    fill(20);
    textAlign(LEFT, TOP);
    textSize(12);
    text(`${this.label}: ${nf(this.val(),1,2)}`, this.x, this.y);
  }
  val(){ return this.s.value(); }
}

// -------------------- Quantum TLS model --------------------
class TLS {
  constructor(){
    this.t = 0;

    // complex amplitudes in {|L>,|R>}
    this.cL = {re: 1.0, im: 0.0};
    this.cR = {re: 0.0, im: 0.0};

    // fixed "energy basis" reference eigenvectors (computed from eps0,t)
    this.ref = null; // {ceL, ceR, cgL, cgR} real coefficients
    this.lastRefParams = {eps0: null, t: null};
  }

  // drive frequency: ωd = ωTLS + δ. Take ωTLS = 1 in cartoon units.
  omegaD(p){ return 1.0 + p.det; }

  eps(t, p){
    return p.eps0 + p.A * cos(TWO_PI * this.omegaD(p) * t);
  }

  // complex helpers
  cAdd(a,b){ return {re:a.re+b.re, im:a.im+b.im}; }
  cMulReal(a,x){ return {re:a.re*x, im:a.im*x}; }
  cMulNegI(a){ return {re:a.im, im:-a.re}; } // -i*a
  cAbs2(a){ return a.re*a.re + a.im*a.im; }

  // ensure reference basis matches (eps0,t)
  updateReferenceBasis(p){
    if (this.lastRefParams.eps0 === p.eps0 && this.lastRefParams.t === p.t && this.ref) return;

    // static Hamiltonian at eps=eps0:
    // H0 = [[+eps0/2, t/2],[t/2, -eps0/2]]
    // excited eigenvector ( +E/2 ) : |e> = cos(θ/2)|L> + sin(θ/2)|R>
    // ground  eigenvector ( -E/2 ) : |g> = -sin(θ/2)|L> + cos(θ/2)|R>
    const eps0 = p.eps0;
    const tC = p.t;
    const E = Math.sqrt(eps0*eps0 + tC*tC + 1e-12);

    const cosHalf = Math.sqrt((1 + eps0/E)/2);
    const sinHalf = Math.sign(tC) * Math.sqrt((1 - eps0/E)/2);

    this.ref = {
      // |e> coefficients
      eL: cosHalf,
      eR: sinHalf,
      // |g> coefficients
      gL: -sinHalf,
      gR: cosHalf
    };
    this.lastRefParams = {eps0: p.eps0, t: p.t};
  }

  // Schrödinger step in {|L>,|R>} with time-dependent eps(t)
  step(dt, p){
    this.updateReferenceBasis(p);
    this.t += dt;

    const eps = this.eps(this.t, p);
    const tC = p.t;

    // Hψ:
    const HL = this.cAdd(this.cMulReal(this.cL, eps/2), this.cMulReal(this.cR, tC/2));
    const HR = this.cAdd(this.cMulReal(this.cL, tC/2), this.cMulReal(this.cR, -eps/2));

    // dψ = -i Hψ dt
    const dL = this.cMulReal(this.cMulNegI(HL), dt);
    const dR = this.cMulReal(this.cMulNegI(HR), dt);

    this.cL = this.cAdd(this.cL, dL);
    this.cR = this.cAdd(this.cR, dR);

    // renormalize
    const n = Math.sqrt(this.cAbs2(this.cL) + this.cAbs2(this.cR) + 1e-12);
    this.cL = this.cMulReal(this.cL, 1/n);
    this.cR = this.cMulReal(this.cR, 1/n);
  }

  PL(){ return this.cAbs2(this.cL); }
  PR(){ return this.cAbs2(this.cR); }

  // Populations in fixed reference |g>,|e>
  refEnergyPops(){
    const r = this.ref;

    // ce = <e|ψ> = eL*cL + eR*cR   (coefficients real)
    const ce = { re: r.eL*this.cL.re + r.eR*this.cR.re,
                 im: r.eL*this.cL.im + r.eR*this.cR.im };
    const cg = { re: r.gL*this.cL.re + r.gR*this.cR.re,
                 im: r.gL*this.cL.im + r.gR*this.cR.im };

    const Pe = this.cAbs2(ce);
    const Pg = this.cAbs2(cg);
    return {Pe, Pg};
  }
}

// -------------------- Drawing --------------------
function drawPanel(x,y,w,h){
  noStroke();
  fill(255);
  rect(x,y,w,h,18);
  stroke(0,0,0,18);
  strokeWeight(1);
  noFill();
  rect(x,y,w,h,18);
  noStroke();
}

function drawPositionPanel(x,y,w,h,tls,p){
  noStroke();
  fill(18);
  textSize(15);
  textAlign(LEFT, TOP);
  text("Position basis", x+18, y+14);

  const dwX = x + 26;
  const dwY = y + 60;
  const dwW = w * 0.82;
  const dwH = h * 0.80;

  const eps = tls.eps(tls.t, p);
  const wells = drawDoubleWellSTM(dwX, dwY, dwW, dwH, p.sep, p.V0, eps);

  const PL = tls.PL();
  const PR = tls.PR();

  drawBlob(wells.xL, wells.yL - 10, 10 + 12*PL, [245,180,70], 25 + 235*PL);
  drawBlob(wells.xR, wells.yR - 10, 10 + 12*PR, [245,180,70], 25 + 235*PR);

  fill(55);
  textSize(16);
  textAlign(CENTER, TOP);
  text("|L⟩", wells.xL, dwY + dwH*0.83);
  text("|R⟩", wells.xR, dwY + dwH*0.83);

  drawDriveSquiggle(dwX + dwW*0.62, y + 54, dwW*0.30, 30, tls.t, tls.omegaD(p), p.A, [60,110,180]);
}

function drawEnergyPanel(x,y,w,h,tls,p){
  noStroke();
  fill(18);
  textSize(15);
  textAlign(LEFT, TOP);
  text("Energy basis", x+18, y+14);

  const ex = x + 44;
  const ey = y + 90;
  const ew = w * 0.66;
  const eh = h * 0.72;

  const pops = tls.refEnergyPops();
  drawEnergyLevels(ex, ey, ew, eh, pops.Pe);

  fill(55);
  textSize(16);
  textAlign(LEFT, CENTER);
  text("|e⟩", ex + ew*0.08, ey + eh*0.28);
  text("|g⟩", ex + ew*0.08, ey + eh*0.74);

  drawDriveSquiggle(ex + ew*0.62, y + 54, ew*0.28, 30, tls.t, tls.omegaD(p), p.A, [240,90,90]);
}

function drawBlob(x,y,r,col,a){
  noStroke();
  for(let k=7;k>=1;k--){
    const rr = r*(1 + 0.22*k);
    const aa = a*(0.055*k);
    fill(col[0], col[1], col[2], aa);
    circle(x,y,2*rr);
  }
  fill(col[0], col[1], col[2], a);
  circle(x,y,2*r);
}

function drawDoubleWellSTM(x0,y0,w,h,sep,V0,eps){
  // V(x) = V0 * (x^2 - (sep/2)^2)^2 + tilt*x
  const a = V0;
  const s = sep * 0.75;      // visual separation scale
  const tilt = 0.55 * eps;

  // baseline
  stroke(0,0,0,18);
  strokeWeight(1.2);
  line(x0, y0+h*0.78, x0+w, y0+h*0.78);

  // curve
  stroke(20,20,20,230);
  strokeWeight(5.2);
  noFill();
  beginShape();
  for(let i=0;i<=320;i++){
    const u=i/320;
    const x = lerp(-1.7, 1.7, u);
    const V = a * sq(x*x - sq(s/2)) + tilt * x;
    const xx = x0 + u*w;
    const yy = y0 + h*0.78 - 0.16*h*V;
    vertex(xx,yy);
  }
  endShape();
  noStroke();

  // minima positions ~ ±s/2
  const xmin=-1.7, xmax=1.7;
  const xLmodel = -s/2;
  const xRmodel = +s/2;
  const uL = (xLmodel - xmin)/(xmax-xmin);
  const uR = (xRmodel - xmin)/(xmax-xmin);

  const xL = x0 + uL*w;
  const xR = x0 + uR*w;

  const VL = a * sq(xLmodel*xLmodel - sq(s/2)) + tilt * xLmodel;
  const VR = a * sq(xRmodel*xRmodel - sq(s/2)) + tilt * xRmodel;
  const yL = y0 + h*0.78 - 0.16*h*VL;
  const yR = y0 + h*0.78 - 0.16*h*VR;

  return {xL, xR, yL, yR};
}

function drawEnergyLevels(x,y,w,h,Pe){
  stroke(0,0,0,16);
  strokeWeight(1.1);
  noFill();
  rect(x,y,w,h,18);

  const yE = y + h*0.28;
  const yG = y + h*0.74;

  stroke(20,20,20,230);
  strokeWeight(5.0);
  line(x+w*0.18, yE, x+w*0.82, yE);
  line(x+w*0.18, yG, x+w*0.82, yG);

  stroke(240,90,90,220);
  strokeWeight(3.0);
  line(x+w*0.50, yG-10, x+w*0.50, yE+10);
  const ax=x+w*0.50, ay=yE+10;
  line(ax,ay, ax-7, ay+11);
  line(ax,ay, ax+7, ay+11);

  drawBlob(x+w*0.75, yE, 9 + 7*Pe, [240,90,90], 25 + 235*Pe);
  drawBlob(x+w*0.75, yG, 9 + 7*(1-Pe), [60,110,180], 25 + 235*(1-Pe));

  const barX = x+w*0.88;
  const barW = w*0.07;
  const barH = h*0.60;
  const barY = y + h*0.20;

  noStroke();
  fill(0,0,0,12);
  rect(barX, barY, barW, barH, 12);
  fill(240,90,90,210);
  rect(barX, barY + barH*(1-Pe), barW, barH*Pe, 12);
}

function drawDriveSquiggle(x,y,w,h,t,omegaD,A,col){
  const amp = 0.40*h*clamp(A, 0, 1.5);
  const omega = TWO_PI * omegaD;

  noFill();
  stroke(col[0], col[1], col[2], 220);
  strokeWeight(3.4);
  beginShape();
  for(let i=0;i<=90;i++){
    const u=i/90;
    const xx = x + u*w;
    const phase = TWO_PI*(2*u) + omega*t;
    const yy = y + h*0.5 + amp*sin(phase);
    vertex(xx,yy);
  }
  endShape();

  // tangent-aligned arrow
  const x1 = x + w;
  const phase1 = TWO_PI*(2*1.0) + omega*t;
  const y1 = y + h*0.5 + amp*sin(phase1);

  const dydx = (amp * cos(phase1) * (4*PI)) / max(1, w);
  let vx=1, vy=dydx;
  const n = Math.sqrt(vx*vx + vy*vy);
  vx/=n; vy/=n;

  const L = 16;
  const backX = x1 - L*vx;
  const backY = y1 - L*vy;

  stroke(col[0], col[1], col[2], 220);
  strokeWeight(3.4);
  line(x1, y1, backX, backY);

  const wing = 9;
  const px = -vy, py = vx;
  line(x1, y1, backX + wing*px, backY + wing*py);
  line(x1, y1, backX - wing*px, backY - wing*py);
  noStroke();
}

function clamp(x,a,b){ return Math.max(a, Math.min(b,x)); }
