from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from googletrans import Translator
import requests
from gtts import gTTS
import os
import time
import textract
import logging
from werkzeug.utils import secure_filename
from reportlab.pdfgen import canvas 
import textwrap 
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.pagesizes import letter
from autocorrect import Speller
import speech_recognition as sr

# ✅ Import Image Generator Blueprint
from imgen import image_generator_bp  

app = Flask(__name__)
CORS(app)  # ✅ Enable CORS for frontend requests

# ✅ Register Blueprint for Image Generation
app.register_blueprint(image_generator_bp, url_prefix="/images")

translator = Translator()
spell = Speller(lang='en')

# ✅ Configure Logging
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")

# ✅ Ensure 'static' directory exists for storing files
os.makedirs('static', exist_ok=True)

# ✅ Allowed File Extensions
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx'}

def allowed_file(filename):
    """Check if uploaded file is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/")
def start_page():
    """Render the start page."""
    return render_template("start.html")

@app.route("/index")
def home():
    """Render the index (translation) page."""
    return render_template("index.html")

@app.route("/gen")  
def images():
    """Render the image generation page."""
    return render_template("gen.html")  # ✅ Ensure gen.html exists in templates/

@app.route("/listen", methods=["POST"])
def listen():
    """Capture and process speech input from the microphone."""
    recognizer = sr.Recognizer()

    with sr.Microphone() as source:
        print("Listening for speech input...")
        recognizer.adjust_for_ambient_noise(source)
        audio = recognizer.listen(source)

    try:
        text = recognizer.recognize_google(audio)
        return jsonify({"recognizedText": text})
    except sr.UnknownValueError:
        return jsonify({"error": "Could not understand the audio"}), 400
    except sr.RequestError as e:
        return jsonify({"error": f"Speech recognition failed: {str(e)}"}), 500
    
# ✅ **Translation API**
@app.route("/translate", methods=["POST"])
def translate_text():
    """Translate text and provide correct transliteration for supported languages."""
    data = request.json
    text = data.get("text", "").strip()
    target_language = data.get("language", "").strip()

    if not text or not target_language:
        return jsonify({"error": "Text and target language are required."}), 400

    try:
        corrected_text = spell(text)  # ✅ Auto-correct English input
        translation = translator.translate(corrected_text, dest=target_language)  # ✅ Translate text

        return jsonify({
            "translatedText": translation.text
        })

    except Exception as e:
        logging.error(f"Translation failed: {e}")
        return jsonify({"error": f"Translation failed: {str(e)}"}), 500

# ✅ **Auto-Correction API**
@app.route("/autocorrect", methods=["GET"])
def autocorrect_text():
    """Correct the spelling of given text (English only)."""
    text = request.args.get("text", "").strip()

    if not text:
        return jsonify({"error": "Text is required."}), 400

    try:
        corrected_text = spell(text)  # Auto-correct English input
        logging.debug(f"Original: {text}, Corrected: {corrected_text}")
        return jsonify({"correctedText": corrected_text})
    except Exception as e:
        logging.error(f"Auto-correction failed: {e}")
        return jsonify({"error": f"Auto-correction failed: {str(e)}"}), 500

# ✅ **Text-to-Speech API**
@app.route("/speak", methods=["POST"])
def speak():
    """Convert translated text to speech."""
    data = request.json
    text = data.get("text", "").strip()
    language = data.get("language", "").strip()

    if not text or not language:
        return jsonify({"error": "Text and language are required."}), 400

    try:
        audio_file_name = f"translation_{int(time.time())}.mp3"
        audio_file_path = os.path.join('static', audio_file_name)

        tts = gTTS(text=text, lang=language)
        tts.save(audio_file_path)

        return jsonify({"audioUrl": f"/static/{audio_file_name}"})
    except Exception as e:
        logging.error(f"Text-to-speech failed: {e}")
        return jsonify({"error": f"Text-to-speech failed: {str(e)}"}), 500

# ✅ **File Upload & Translation API**
@app.route("/upload", methods=["POST"])
def upload():
    """Handle file upload, translate full content, and generate a downloadable PDF."""
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded."}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected."}), 400

    if file and allowed_file(file.filename):
        try:
            filename = secure_filename(file.filename)
            file_path = os.path.join('static', filename)
            file.save(file_path)

            # ✅ Extract text from the file
            extracted_text = textract.process(file_path).decode('utf-8').strip()
            if not extracted_text:
                raise ValueError("Extracted text is empty or None")

            target_language = request.form.get("language", "").strip()
            if not target_language:
                return jsonify({"error": "Target language is required."}), 400

            corrected_text = spell(extracted_text)  # ✅ Auto-correct full text

            # ✅ Split text into chunks of 4500 characters to fit API limits
            max_chars = 4500
            text_chunks = [corrected_text[i:i + max_chars] for i in range(0, len(corrected_text), max_chars)]

            translated_chunks = []
            for chunk in text_chunks:
                translation = translator.translate(chunk, dest=target_language)
                translated_chunks.append(translation.text)

            # ✅ Combine all translated chunks into final text
            translated_text = "\n".join(translated_chunks)

            # ✅ Generate a downloadable PDF
            pdf_filename = f"translated_{int(time.time())}.pdf"
            pdf_path = os.path.join('static', pdf_filename)
            generate_pdf(translated_text, pdf_path)

            return jsonify({
                "translatedText": translated_text,
                "pdfUrl": f"/static/{pdf_filename}"
            })
        except Exception as e:
            logging.error(f"File processing failed: {e}")
            return jsonify({"error": f"File processing failed: {str(e)}"}), 500
    else:
        return jsonify({"error": "Unsupported file type. Only .txt, .pdf, .docx allowed."}), 400
    
#generate pdf 
def generate_pdf(text, filename):
    """Generate a PDF with proper spacing, Unicode support, justified text, and pagination without losing lines."""
    
    if not text.strip():
        text = "No content available."

    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter  

    # ✅ Register Universal Font (Full Unicode Support)
    try:
        pdfmetrics.registerFont(TTFont("UnicodeFont", "NotoSans-Regular.ttf"))  # Use NotoSans or Arial Unicode MS
        text_font = "UnicodeFont"
    except:
        print("⚠ Font not found! Falling back to default font.")
        text_font = "Helvetica"  # Basic fallback

    # ✅ Font & Layout Settings
    title_font = text_font
    title_size = 18
    text_size = 12
    line_spacing = 20  
    left_margin = 60  
    right_margin = 60
    text_width = width - (left_margin + right_margin)  
    y_position = height - 80  

    # ✅ Draw Title
    c.setFont(title_font, title_size)
    c.drawCentredString(width / 2, height - 50, "Translated Document")
    c.line(left_margin, height - 60, width - right_margin, height - 60)

    # ✅ Set text font
    c.setFont(text_font, text_size)

    # ✅ Process Paragraphs with Justified Alignment
    paragraphs = text.split("\n")
    for paragraph in paragraphs:
        words = paragraph.split(" ")
        line = ""

        for word in words:
            test_line = line + word + " "
            if c.stringWidth(test_line, text_font, text_size) < text_width:
                line = test_line  # ✅ Add word if it fits
            else:
                # ✅ Before printing, check if a new page is needed
                if y_position < 50:
                    c.showPage()
                    c.setFont(text_font, text_size)
                    y_position = height - 80

                draw_justified_text(c, line.strip(), left_margin, y_position, text_width, text_font, text_size)  
                y_position -= line_spacing  # ✅ Move down for next line
                line = word + " "  # ✅ Start new line

        if line.strip():  # ✅ Print last line of paragraph
            if y_position < 50:
                c.showPage()
                c.setFont(text_font, text_size)
                y_position = height - 80
            c.drawString(left_margin, y_position, line.strip())
            y_position -= line_spacing  

        y_position -= line_spacing  # ✅ Extra space between paragraphs

    c.save()
    print(f"✅ PDF successfully generated: {filename}")

def draw_justified_text(c, text, x, y, width, font, size):
    """Draw justified text without cutting off lines."""
    words = text.split()
    if len(words) == 1:
        c.drawString(x, y, text)  # If only one word, left-align it
        return

    total_spaces = len(words) - 1
    text_width = c.stringWidth(text, font, size)
    extra_space = (width - text_width) / total_spaces if total_spaces > 0 else 0  # Distribute space evenly

    x_pos = x
    for word in words[:-1]:
        c.drawString(x_pos, y, word)
        x_pos += c.stringWidth(word, font, size) + extra_space  # Move x position with extra space
    c.drawString(x_pos, y, words[-1])  # Draw last word

    
# ✅ **Run Flask App**
if __name__ == "__main__":
    app.run(debug=True)