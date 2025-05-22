// ✅ **Get DOM Elements**
const micButton = document.getElementById("micButton");
const inputText = document.getElementById("inputText");
const languageSelect = document.getElementById("languageSelect");
const outputText = document.getElementById("outputText");
const audioContainer = document.getElementById("audioContainer");
const translationAudio = document.getElementById("translationAudio");
const translateButton = document.getElementById("translateButton");
const uploadFileInput = document.getElementById("uploadFile");
const downloadTranslationButton = document.getElementById("downloadTranslation");
const shareWhatsappButton = document.getElementById("shareWhatsapp");
const translateIcon = document.getElementById("translateIcon");
const loadingSpinner = document.getElementById("loadingSpinner");

let recognition;
let debounceTimer;
let lastCorrectedText = "";
let lastUserInput = ""; // To track raw user input

// ✅ **Initialize Speech Recognition**
if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;  // Stop listening after speech is detected
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
        inputText.value = event.results[0][0].transcript;
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "no-speech") {
            alert("No speech detected. Please try again.");
        } else if (event.error === "audio-capture") {
            alert("Microphone access issue. Check your microphone settings.");
        } else if (event.error === "not-allowed") {
            alert("Microphone permission denied. Enable microphone in browser settings.");
        }
    };
} else {
    alert("Speech recognition is not supported in this browser. Please use Chrome.");
}

// ✅ **Handle Microphone Button Click**
if (micButton) {
    micButton.addEventListener("click", () => {
        console.log("🎤 Mic Button Clicked!");
        if (recognition) {
            try {
                recognition.stop();
                setTimeout(() => {
                    recognition.start();
                    console.log("🔊 Recognition started!");
                }, 500); // Small delay to prevent conflicts
            } catch (error) {
                console.error("❌ Microphone access error:", error);
            }
        } else {
            alert("Speech recognition not supported.");
        }
    });
}

// ✅ Create a suggestion box dynamically
const suggestionBox = document.createElement("div");
suggestionBox.style.position = "absolute";
suggestionBox.style.background = "#fff";
suggestionBox.style.border = "1px solid #ccc";
suggestionBox.style.padding = "5px";
suggestionBox.style.display = "none";
suggestionBox.style.cursor = "pointer";
suggestionBox.style.fontSize = "14px";
suggestionBox.style.boxShadow = "0px 2px 5px rgba(0,0,0,0.2)";
document.body.appendChild(suggestionBox);

// ✅ **Auto-Correct with Clickable Suggestion**
async function autoCorrectText(text) {
    text = text.trim();
    if (!text || text === lastCorrectedText || text === lastUserInput) return;
    lastUserInput = text;

    try {
        console.log("🔍 Sending text for auto-correction:", text);

        const response = await fetch(`/autocorrect?text=${encodeURIComponent(text)}`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();
        console.log("✅ Auto-correct API Response:", data);

        if (data.correctedText && data.correctedText !== lastCorrectedText) {
            lastCorrectedText = data.correctedText;
            showAutoCorrectSuggestion(data.correctedText);
        } else {
            hideSuggestionBox();
        }
    } catch (error) {
        console.error("❌ Auto-correct error:", error);
    }
}

// ✅ **Show Suggestion Separately**
function showAutoCorrectSuggestion(suggestion) {
    if (!suggestion || suggestion === lastUserInput) {
        hideSuggestionBox();
        return;
    }

    // Position the suggestion box below the input field
    const rect = inputText.getBoundingClientRect();
    suggestionBox.style.left = `${rect.left}px`;
    suggestionBox.style.top = `${rect.bottom + window.scrollY}px`;
    suggestionBox.style.width = `${rect.width}px`;

    // Set suggestion text
    suggestionBox.innerHTML = `<strong>Suggestion:</strong> 
        <span id="suggestionText" style="color: blue; text-decoration: underline; cursor: pointer;">${suggestion}</span>`;
    suggestionBox.style.display = "block";

    // Click to insert suggestion at cursor position
    document.getElementById("suggestionText").onclick = (event) => {
        event.preventDefault(); // Prevent focus loss
        insertAtCursor(inputText, suggestion);
        hideSuggestionBox();
    };
}

// ✅ **Insert Text at Cursor Position**
function insertAtCursor(input, text) {
    const startPos = input.selectionStart;
    const endPos = input.selectionEnd;

    // Insert suggestion at the cursor position
    input.value = input.value.substring(0, startPos) + text + input.value.substring(endPos);

    // Restore focus and set cursor after inserted text
    input.focus();
    input.setSelectionRange(startPos + text.length, startPos + text.length);
}

// ✅ **Hide Suggestion Box**
function hideSuggestionBox() {
    suggestionBox.style.display = "none";
}

// ✅ **Real-Time Auto-Correction with Smarter Delay**
if (inputText) {
    inputText.addEventListener("input", function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            autoCorrectText(inputText.value);
        }, 800); // Slightly longer delay for smoother typing
    });

    inputText.addEventListener("blur", () => setTimeout(hideSuggestionBox, 200)); // Delay to allow clicking the suggestion
}

// ✅ **Handle Translate Button Click**
if (translateButton) {
    translateButton.addEventListener("click", async () => {
        const text = inputText.value.trim();
        if (!text) {
            alert("Please enter some text to translate.");
            return;
        }

        // Show loading spinner
        if (translateIcon) translateIcon.style.display = "none";
        if (loadingSpinner) loadingSpinner.style.display = "inline-block";
        translateButton.disabled = true;

        try {
            await translateText(text);
        } catch (error) {
            console.error("Translation process failed:", error);
        }

        // Restore button state
        if (translateIcon) translateIcon.style.display = "inline-block";
        if (loadingSpinner) loadingSpinner.style.display = "none";
        translateButton.disabled = false;
    });
}

// ✅ **Perform Translation**
async function translateText(text) {
    const targetLanguage = languageSelect ? languageSelect.value : "en";

    try {
        const response = await fetch("/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, language: targetLanguage }),
        });

        const data = await response.json();

        if (data.translatedText) {
            if (outputText) {
                outputText.innerHTML = `<div id="translatedText" class="translated-text"><strong>Translation:</strong> ${data.translatedText}</div>`;
            }

            playTranslation(data.translatedText, targetLanguage);
            downloadTranslationButton.style.display = "inline-block";
            shareWhatsappButton.style.display = "inline-block";
        } else {
            alert("Translation failed: " + (data.error || "Unknown error"));
        }
    } catch (error) {
        console.error("❌ Translation error:", error);
        alert("An error occurred during translation. Please try again.");
    }
}

// ✅ **Handle File Upload and Translation**
if (uploadFileInput) {
    uploadFileInput.addEventListener("change", async function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const targetLanguage = languageSelect.value || "en";
        const formData = new FormData();
        formData.append("file", file);
        formData.append("language", targetLanguage);

        try {
            const response = await fetch("/upload", { method: "POST", body: formData });
            const data = await response.json();

            if (data.translatedText) {
                outputText.innerHTML = `<div id="translatedText" class="translated-text">${data.translatedText}</div>`;
                playTranslation(data.translatedText, targetLanguage);
                downloadTranslationButton.style.display = "inline-block";
            }
        } catch (error) {
            console.error("❌ File upload error:", error);
        }
    });
}

// ✅ **Play Translated Text as Speech**
async function playTranslation(translatedText, language) {
    try {
        const response = await fetch("/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: translatedText, language }),
        });

        const data = await response.json();

        if (data.audioUrl) {
            audioContainer.style.display = "block";
            translationAudio.src = data.audioUrl;
            translationAudio.play();
        } else {
            throw new Error(data.error || "Audio generation failed");
        }
    } catch (error) {
        console.error("❌ Text-to-speech error:", error);
        alert(`Text-to-speech failed: ${error.message}`);
    }
}

async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let translatedTextElement = document.getElementById("translatedText");
    if (!translatedTextElement) {
        alert("No translated text available to download.");
        return;
    }

    let translatedText = translatedTextElement.innerText.replace("Translation:", "").trim();

    try {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);

        doc.text("Translated Text:", 10, 10);

        // ✅ Wrap long text properly
        let splitText = doc.splitTextToSize(translatedText, 180);
        doc.text(splitText, 10, 20);

        doc.save("translated_text.pdf");
    } catch (error) {
        console.error("❌ PDF generation error:", error);
        alert("Error generating PDF. Please try again.");
    }
}

// ✅ **Handle Download Button Click**
if (downloadTranslationButton) {
    downloadTranslationButton.addEventListener("click", generatePDF);
}

// ✅ **Share translated text and audio to WhatsApp**
shareWhatsappButton.addEventListener("click", sendToWhatsApp);

function sendToWhatsApp() {
    const translatedTextElement = outputText.querySelector(".translated-text");
    const audioUrl = translationAudio.src;

    if (!translatedTextElement) {
        alert("No translated text to share.");
        return;
    }

    const translatedText = translatedTextElement.textContent.trim();
    

    const whatsappUrl = `https://wa.me/?text=Translation:%20${encodeURIComponent(translatedText)}%0A${audioUrl ? "Audio:%20" + encodeURIComponent(audioUrl) : ""}`;
    window.open(whatsappUrl, "_blank");
}

