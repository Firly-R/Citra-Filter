const vElement = document.getElementById('v_src');
const cElement = document.getElementById('out');
const ctx = cElement.getContext('2d');

// Inisialisasi Element Video Aset
const n = document.getElementById('n');
const s = document.getElementById('s');
const cobra = document.getElementById('cobra');
const mp40 = document.getElementById('mp40');

let pwrNS = [0, 0];        // Power untuk [Naruto, Sasuke]
let pwrCobra = 0;          // Power untuk Emote Cobra
let wasOpenNS = [false, false];
let wasCobraActive = false;
let lastCx = 0.5, lastCy = 0.5;

function checkOpen(pts) {
    let count = 0;
    const wrist = pts[0];
    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];
    for (let i = 0; i < tips.length; i++) {
        const tip = pts[tips[i]];
        const pip = pts[pips[i]];
        if (Math.hypot(tip.x - wrist.x, tip.y - wrist.y) > Math.hypot(pip.x - wrist.x, pip.y - wrist.y)) count++;
    }
    return count >= 3;
}

function onResults(res) {
    cElement.width = vElement.videoWidth;
    cElement.height = vElement.videoHeight;
    ctx.save();
    ctx.clearRect(0, 0, cElement.width, cElement.height);

    // Sembunyikan semua efek di awal frame
    n.style.display = 'none';
    s.style.display = 'none';
    cobra.style.display = 'none';
    mp40.style.display = 'none';

    let openHandsCount = 0;
    let currentHandsPos = [];

    if (res.multiHandLandmarks && res.multiHandedness) {
        for (let i = 0; i < res.multiHandLandmarks.length; i++) {
            const pts = res.multiHandLandmarks[i];
            const label = res.multiHandedness[i].label;
            
            // Konfigurasi Mirroring Handedness
            const isR = label === 'Right';
            const idx = isR ? 1 : 0;

            // Efek Glow Neon Merah untuk kerangka tangan tema Cobra
            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff003c';
            drawConnectors(ctx, pts, HAND_CONNECTIONS, {color: '#ff3b00', lineWidth: 3});
            drawLandmarks(ctx, pts, {color: '#ffffff', lineWidth: 1, radius: 2});
            ctx.restore();

            const open = checkOpen(pts);
            if (open) openHandsCount++;

            currentHandsPos.push({ pts: pts, isR: isR, idx: idx, isOpen: open });
        }
    }

    // --- KONDISI 1: JIKA DUA TANGAN TERBUKA BERSAMAAN (EMOTE COBRA) ---
    const cobraTriggered = (currentHandsPos.length === 2 && openHandsCount === 2);

    if (cobraTriggered) {
        pwrCobra = Math.min(1, pwrCobra + 0.06);
        pwrNS[0] = Math.max(0, pwrNS[0] - 0.15);
        pwrNS[1] = Math.max(0, pwrNS[1] - 0.15);

        // Hitung titik tengah (Midpoint) di antara dua tangan
        lastCx = (currentHandsPos[0].pts[9].x + currentHandsPos[1].pts[9].x) / 2;
        lastCy = (currentHandsPos[0].pts[9].y + currentHandsPos[1].pts[9].y) / 2;

        if (!wasCobraActive) {
            cobra.currentTime = 0; mp40.currentTime = 0;
            cobra.play(); mp40.play();
        }
        wasCobraActive = true;
        wasOpenNS = [false, false];
    } 
    // --- KONDISI 2: JIKA HANYA SATU TANGAN (NARUTO / SASUKE) ---
    else {
        pwrCobra = Math.max(0, pwrCobra - 0.12);
        wasCobraActive = false;

        let handsFound = [false, false];
        currentHandsPos.forEach(hand => {
            handsFound[hand.idx] = true;
            if (hand.isOpen) {
                pwrNS[hand.idx] = Math.min(1, pwrNS[hand.idx] + 0.05);
                if (!wasOpenNS[hand.idx]) {
                    if (hand.idx === 0) n.currentTime = 0; else s.currentTime = 0;
                }
                wasOpenNS[hand.idx] = true;
            } else {
                pwrNS[hand.idx] = Math.max(0, pwrNS[hand.idx] - 0.15);
                wasOpenNS[hand.idx] = false;
            }
        });

        // Efek memudar halus saat tangan keluar kamera
        if (!handsFound[0]) { pwrNS[0] = Math.max(0, pwrNS[0] - 0.15); wasOpenNS[0] = false; }
        if (!handsFound[1]) { pwrNS[1] = Math.max(0, pwrNS[1] - 0.15); wasOpenNS[1] = false; }
    }

    // --- PROSES RENDERING GRAFIS ---
    
    // Render Layer MP40 & Cobra
    if (pwrCobra > 0.01) {
        cobra.style.left = `${(1 - lastCx) * window.innerWidth}px`;
        cobra.style.top = `${(lastCy * window.innerHeight) - 280}px`;
        cobra.style.display = 'block'; cobra.style.opacity = pwrCobra;

        mp40.style.left = `${(1 - lastCx) * window.innerWidth}px`;
        mp40.style.top = `${lastCy * window.innerHeight}px`;
        mp40.style.display = 'block'; mp40.style.opacity = pwrCobra;
    }

    // Render Layer Naruto / Sasuke (Hanya muncul jika mode Cobra sedang mati)
    if (pwrCobra <= 0.01) {
        // Naruto (Tangan Kiri - Rasengan)
        if (pwrNS[0] > 0.01 && currentHandsPos.find(h => h.idx === 0)) {
            const hand = currentHandsPos.find(h => h.idx === 0).pts;
            const tx = hand[9].x + ((hand[9].x - hand[0].x) * 0.8);
            const ty = hand[9].y + ((hand[9].y - hand[0].y) * 0.8);
            n.style.left = `${(1 - tx) * window.innerWidth}px`;
            n.style.top = `${(ty * window.innerHeight) - 120}px`;
            n.style.display = 'block'; n.style.opacity = pwrNS[0];
        }
        // Sasuke (Tangan Kanan - Chidori)
        if (pwrNS[1] > 0.01 && currentHandsPos.find(h => h.idx === 1)) {
            const hand = currentHandsPos.find(h => h.idx === 1).pts;
            const tx = (hand[0].x + hand[9].x) / 2;
            const ty = (hand[0].y + hand[9].y) / 2;
            s.style.left = `${(1 - tx) * window.innerWidth}px`;
            s.style.top = `${ty * window.innerHeight}px`;
            s.style.display = 'block'; s.style.opacity = pwrNS[1];
        }
    }

    ctx.restore();
}

const h = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
h.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.65, minTrackingConfidence: 0.65 });
h.onResults(onResults);

const cam = new Camera(vElement, {
    onFrame: async () => { await h.send({ image: vElement }); },
    width: 1280, height: 720
});
cam.start();