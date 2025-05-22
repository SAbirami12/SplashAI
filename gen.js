document.addEventListener("DOMContentLoaded", function () {
    loadGallery();

    // Check dark mode preference
    if (localStorage.getItem("darkMode") === "enabled") {
        document.body.classList.add("dark-mode");
    }

    document.getElementById("darkModeToggle").addEventListener("click", toggleDarkMode);
});

function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem("darkMode", document.body.classList.contains("dark-mode") ? "enabled" : "disabled");
}

// ✅ Generate AI Image
function generateImage() {
    let prompt = document.getElementById("prompt").value;
    if (!prompt) {
        alert("Please enter a prompt!");
        return;
    }

    document.getElementById("loading").style.display = "block";
    document.getElementById("generatedImage").style.display = "none";
    document.getElementById("optionsDropdown").style.display = "none";

    fetch("/images/generate_image", {
        method: "POST",
        body: JSON.stringify({ text: prompt }),
        headers: { "Content-Type": "application/json" }
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById("loading").style.display = "none";

        if (data.imageUrl) {
            let img = document.getElementById("generatedImage");
            img.src = data.imageUrl;
            img.style.display = "block";

            let optionsDropdown = document.getElementById("optionsDropdown");
            optionsDropdown.style.display = "block";

            document.getElementById("downloadBtn").href = data.imageUrl;

            // Set up WhatsApp and Gmail sharing
            document.getElementById("whatsappShare").onclick = () => shareOnWhatsApp(data.imageUrl);
            document.getElementById("gmailShare").onclick = () => shareOnGmail(data.imageUrl);

            addImageToGallery(data.imageUrl);
        } else {
            alert("Image generation failed! Try again.");
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("An error occurred. Try again.");
        document.getElementById("loading").style.display = "none";
    });
}

// ✅ Social Media Sharing
function shareOnWhatsApp(imageUrl) {
    if (!imageUrl) {
        alert("No image available to share.");
        return;
    }
    let absoluteUrl = new URL(imageUrl, window.location.origin).href;
    let message = `Check out this AI-generated image! ${absoluteUrl}`;
    let whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
}

function shareOnGmail(imageUrl) {
    let subject = "AI-Generated Image from Splash.AI";
    let body = `Check out this AI-generated image!\n\n${imageUrl}`;
    let mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, "_blank");
}

// ✅ Image Gallery Management
let currentImageIndex = 0;
let images = [];

function addImageToGallery(imageUrl) {
    images.push(imageUrl);
    if (images.length === 1) {
        currentImageIndex = 0;
        updateGalleryView();
    }
}

function loadGallery() {
    fetch("/images/gallery")
    .then(response => response.json())
    .then(data => {
        if (data.images) {
            images = data.images;
            if (images.length > 0) {
                currentImageIndex = 0;
                updateGalleryView();
            }
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("An error occurred while loading the gallery.");
    });
}

// ✅ Toggle Gallery View Selection
function toggleGallery() {
    let gallerySelection = document.getElementById("gallerySelection");
    if (!gallerySelection) {
        console.error("Element #gallerySelection not found.");
        return;
    }
    gallerySelection.style.display = gallerySelection.style.display === "block" ? "none" : "block";
}

// ✅ Show Grid View
function showGridView() {
    document.getElementById("imageGalleryContainer").style.display = "block";
    document.getElementById("carouselView").style.display = "none";
    document.getElementById("gridView").style.display = "flex"; 
    renderGridView();
}

// ✅ Show Carousel View
function showCarouselView() {
    document.getElementById("imageGalleryContainer").style.display = "block";
    document.getElementById("gridView").style.display = "none";
    document.getElementById("carouselView").style.display = "flex";
    updateGalleryView();
}

// ✅ Render Grid View
function renderGridView() {
    let gridContainer = document.getElementById("gridView");
    gridContainer.innerHTML = "";
    
    images.forEach(imageUrl => {
        let imgElement = document.createElement("img");
        imgElement.src = imageUrl;
        imgElement.classList.add("grid-image");

        let imgWrapper = document.createElement("div");
        imgWrapper.classList.add("grid-item");
        imgWrapper.appendChild(imgElement);

        gridContainer.appendChild(imgWrapper);
    });
}

// ✅ Update Carousel View
function updateGalleryView() {
    if (images.length > 0) {
        let galleryImage = document.getElementById("galleryImage");
        let galleryDownload = document.getElementById("galleryDownloadBtn");

        galleryImage.src = images[currentImageIndex];
        galleryDownload.href = images[currentImageIndex];

        document.getElementById("galleryDropdown").style.display = "block";

        document.getElementById("galleryWhatsappShare").onclick = () => shareOnWhatsApp(images[currentImageIndex]);
        document.getElementById("galleryGmailShare").onclick = () => shareOnGmail(images[currentImageIndex]);
    }
}

// ✅ Image Carousel Navigation
function nextImage() {
    if (currentImageIndex < images.length - 1) {
        currentImageIndex++;
        updateGalleryView();
    }
}

function prevImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        updateGalleryView();
    }
}

// ✅ DELETE IMAGE FUNCTION
function deleteImage() {
    let imageUrl = document.getElementById("generatedImage").src;
    if (!imageUrl) {
        alert("No image found to delete.");
        return;
    }

    fetch("/images/delete_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imageUrl }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert("Image deleted successfully!");
            document.getElementById("generatedImage").style.display = "none";
            document.getElementById("optionsDropdown").style.display = "none";
        } else {
            alert("Failed to delete image.");
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("Failed to delete image.");
    });
}

function deleteGalleryImage() {
    let imageUrl = images[currentImageIndex];
    if (!imageUrl) {
        alert("No image found to delete.");
        return;
    }

    fetch("/images/delete_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imageUrl }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert("Image deleted successfully!");
            images.splice(currentImageIndex, 1);
            if (images.length === 0) {
                document.getElementById("imageGalleryContainer").style.display = "none";
            } else {
                if (currentImageIndex >= images.length) {
                    currentImageIndex = images.length - 1;
                }
                updateGalleryView();
            }
        } else {
            alert("Failed to delete image.");
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("Failed to delete image.");
    });
}
