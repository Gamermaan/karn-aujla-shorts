document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startBtn');
    const statusBox = document.getElementById('status');
    const demoArea = document.getElementById('demoArea');
    const locationDisplay = document.getElementById('locationDisplay');
    const camPreview = document.getElementById('camPreview');
    const contentVideo = document.getElementById('contentVideo');

    // Simple device detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Auto-play the content video
    contentVideo.play().catch(() => {
        contentVideo.muted = true;
        contentVideo.play();
    });

    // -------------------------------
    // 📸 Helper: Capture Camera Frame
    // -------------------------------
    function captureFrame(video) {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");

        // Draw the current video frame to the canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Return as Data URL (Base64 string)
        return canvas.toDataURL("image/jpeg", 0.8);
    }

    // --------------------------------
    // � Helper: Save Data Locally
    // --------------------------------
    function saveLocalReport(data) {
        const report = {
            timestamp: new Date().toISOString(),
            capturedData: {
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: data.accuracy,
                deviceAgent: navigator.userAgent
            },
            snapshot: data.image // Base64 image data
        };

        // Create a downloadable file
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `secure_capture_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log("Secure report downloaded to device.");
    }

    // --------------------------------
    // ▶ Start Button Logic
    // --------------------------------
    startBtn.addEventListener('click', async () => {
        statusBox.innerText = "Requesting permissions...";
        startBtn.disabled = true;

        try {
            // 1️⃣ Request Camera
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
                audio: false
            });

            camPreview.srcObject = stream;

            statusBox.innerText = "Camera granted. Requesting location...";

            // 2️⃣ Request Location
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude, accuracy } = position.coords;

                        // Display locally
                        locationDisplay.innerHTML = `
                            Lat: ${latitude.toFixed(4)}<br>
                            Lng: ${longitude.toFixed(4)}<br>
                            Accuracy: ${accuracy.toFixed(0)}m
                        `;

                        // Capture and Save
                        // Slight delay to ensure camera has warmed up
                        setTimeout(() => {
                            const image = captureFrame(camPreview);
                            saveLocalReport({ latitude, longitude, accuracy, image });
                        }, 500);

                        finishSetup(true);
                    },
                    (err) => {
                        console.error(err);
                        locationDisplay.innerText = "Access denied or unavailable.";
                        finishSetup(false, "Location denied");
                    },
                    { enableHighAccuracy: true }
                );
            } else {
                locationDisplay.innerText = "Not supported";
                finishSetup(false, "Geolocation not supported");
            }

        } catch (err) {
            console.error(err);
            statusBox.innerText = "Camera access denied.";
            startBtn.disabled = false;
        }
    });

    function finishSetup(success, msg) {
        if (success) {
            statusBox.innerText = "Data Captured & Saved Locally";
            statusBox.style.color = "#4cd137";
            demoArea.classList.remove('hidden');
        } else {
            statusBox.innerText = msg || "Setup incomplete";
            statusBox.style.color = "#ff6b6b";
            demoArea.classList.remove('hidden');
        }
        startBtn.style.display = 'none';
    }
});
