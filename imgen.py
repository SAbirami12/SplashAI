from flask import Blueprint, request, jsonify
import os
import time
import requests

# Create Blueprint for image generator
image_generator_bp = Blueprint("image_generator", __name__)

# Ensure 'static/images' directory exists
IMAGE_DIR = "static/images"
if not os.path.exists(IMAGE_DIR):
    os.makedirs(IMAGE_DIR)

# Hugging Face API Configuration
HUGGING_FACE_API_KEY = "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"  # Replace with your actual API key
HUGGING_FACE_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"
HEADERS = {"Authorization": f"Bearer {HUGGING_FACE_API_KEY}"}

if not HUGGING_FACE_API_KEY:
    raise ValueError("⚠️ Hugging Face API Key is missing! Set it in environment variables.")

@image_generator_bp.route("/generate_image", methods=["POST"])
def generate_image():
    """Generate and return an image using Hugging Face API."""
    data = request.json
    text = data.get("text")

    if not text:
        return jsonify({"error": "Text prompt is required."}), 400

    try:
        # Send request to Hugging Face API
        response = requests.post(
            f"https://api-inference.huggingface.co/models/{HUGGING_FACE_MODEL}",
            headers=HEADERS,
            json={"inputs": text},
        )

        if response.status_code != 200:
            return jsonify({"error": "Image generation failed!", "details": response.text}), response.status_code

        # Save the generated image
        image_filename = f"generated_{int(time.time())}.png"
        image_path = os.path.join(IMAGE_DIR, image_filename)

        with open(image_path, "wb") as f:
            f.write(response.content)

        return jsonify({
            "imageUrl": f"/{image_path}",
            "downloadUrl": f"/{image_path}"
        })

    except requests.exceptions.RequestException as e:
        return jsonify({"error": "Failed to connect to Hugging Face API.", "details": str(e)}), 500
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred.", "details": str(e)}), 500

@image_generator_bp.route("/gallery", methods=["GET"])
def get_gallery():
    """Retrieve previously generated images."""
    try:
        image_files = [f for f in os.listdir(IMAGE_DIR) if f.endswith(".png")]
        image_urls = [f"/{IMAGE_DIR}/{file}" for file in image_files]
        return jsonify({"images": image_urls})

    except Exception as e:
        return jsonify({"error": "Error retrieving gallery.", "details": str(e)}), 500

@image_generator_bp.route("/delete_image", methods=["POST"])
def delete_image():
    """Delete a specified image from the gallery."""
    data = request.json
    image_url = data.get("imageUrl")

    if not image_url:
        return jsonify({"error": "Image URL is required."}), 400

    image_filename = os.path.basename(image_url)
    image_path = os.path.join(IMAGE_DIR, image_filename)

    try:
        if os.path.exists(image_path):
            os.remove(image_path)
            return jsonify({"message": f"Image '{image_filename}' deleted successfully."}), 200
        else:
            return jsonify({"error": "Image not found."}), 404

    except Exception as e:
        return jsonify({"error": "Failed to delete image.", "details": str(e)}), 500
