window.addEventListener("load", function () {
  const scriptUrls = [
    "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-java.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-c.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-php.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js",
  ];

  let loadedScripts = 0;
  scriptUrls.forEach((url) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = false;
    script.onload = function () {
      loadedScripts++;
      if (loadedScripts === scriptUrls.length) {
        const event = new Event("PrismLoaded");
        document.dispatchEvent(event);
      }
    };
    document.head.appendChild(script);
  });
});

const vscode =
  typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;

const fileListElement = document.getElementById("fileList");
const chatContainer = document.getElementById("chatContainer");

window.addEventListener("message", (event) => {
  const message = event.data;

  switch (message.type) {
    case "setIcons":
      document.getElementById("attachIcon").src = message.attachIconUri;
      document.getElementById("playIcon").src = message.playIconUri;
      break;
    case "chatgptResponse":
      document.getElementById("loading").style.display = "none";
      addMessageToChat("assistant", message.text);
      document.getElementById("analyzeAndChat").classList.remove("animated");
      break;
    case "selectedFiles":
      updateSelectedFiles(message.files);
      break;
  }
});

document.getElementById("selectFiles").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", (event) => {
  const fileList = document.getElementById("fileList");
  fileList.innerHTML = ""; // Очищаем список, чтобы не дублировать файлы

  for (const file of event.target.files) {
    addFileToList(file);
  }
});

document
  .getElementById("analyzeAndChat")
  .addEventListener("click", handleAnalyzeAndChat);

function handleAnalyzeAndChat() {
  const userInput = document.getElementById("userInput").value.trim();
  const loadingElement = document.getElementById("loading");
  const analyzeButton = document.getElementById("analyzeAndChat");

  if (!userInput) {
    indicateEmptyInput();
    return;
  }

  loadingElement.style.display = "block";
  analyzeButton.classList.add("animated");

  if (vscode) {
    vscode.postMessage({
      type: "analyzeAndChat",
      text: userInput,
    });
  }

  addMessageToChat("user", userInput);
  document.getElementById("userInput").value = "";
}

function indicateEmptyInput() {
  const userInputElement = document.getElementById("userInput");
  userInputElement.style.border = "1px solid red";
  setTimeout(() => {
    userInputElement.style.border = "";
  }, 3000);
}

function addMessageToChat(sender, message) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${sender}`;

  // Check if the message contains code block (identified by ```)
  if (message.includes("```")) {
    const parts = message.split("```");
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        const textElement = document.createElement("span");
        textElement.innerText = parts[i];
        messageElement.appendChild(textElement);
      } else {
        const codeContainer = document.createElement("div");
        codeContainer.className = "code-container";

        const codeHeader = document.createElement("div");
        codeHeader.className = "code-header";
        const codeLanguage = detectCodeLanguage(parts[i]);
        codeHeader.innerText = codeLanguage;

        const copyButton = document.createElement("button");
        copyButton.className = "copy-button";
        copyButton.innerText = "Скопировать";
        copyButton.addEventListener("click", () => {
          navigator.clipboard.writeText(parts[i]).then(() => {
            copyButton.innerText = "Скопировано!";
            setTimeout(() => (copyButton.innerText = "Скопировать"), 2000);
          });
        });
        codeHeader.appendChild(copyButton);

        const codeElement = document.createElement("pre");
        codeElement.className = `code-block language-${codeLanguage}`;
        const codeContent = document.createElement("code");
        codeContent.className = `language-${codeLanguage}`;
        codeContent.innerText = parts[i];
        codeElement.appendChild(codeContent);

        codeContainer.appendChild(codeHeader);
        codeContainer.appendChild(codeElement);
        messageElement.appendChild(codeContainer);

        // Apply Prism.js syntax highlighting immediately
        Prism.highlightElement(codeContent);
      }
    }
  } else {
    messageElement.innerText = message;
  }

  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function detectCodeLanguage(code) {
  if (code.includes("<?php")) {
    return "php";
  } else if (
    code.includes("import") ||
    code.includes("export") ||
    code.includes("const") ||
    code.includes("let")
  ) {
    return "javascript";
  } else if (
    code.includes("class") &&
    code.includes("public static void main")
  ) {
    return "java";
  } else if (code.includes("#include") || code.includes("int main")) {
    return "cpp";
  } else if (
    code.includes("def ") ||
    code.includes("import ") ||
    code.includes("print(")
  ) {
    return "python";
  } else if (
    code.includes("type ") ||
    code.includes("interface ") ||
    code.includes("export ")
  ) {
    return "typescript";
  } else {
    return "javascript";
  }
}

function updateSelectedFiles(files) {
  fileListElement.innerHTML = "";
  files.forEach((file) => {
    addFileToList({ name: file });
  });
}

function addFileToList(file) {
  const fileList = document.getElementById("fileList");
  const fileItem = document.createElement("div");
  fileItem.className = "file-item";

  fileItem.innerHTML = `
    <span>
      <img src="${getFileTypeIcon(file.name)}" alt="Файл" class="file-icon" />
      ${file.name}
    </span>
    <button onclick="removeFile('${file.name}')">
      <img src="{{deleteIconUri}}" alt="Удалить файл" />
    </button>
  `;

  fileList.appendChild(fileItem);
}

function removeFile(fileName) {
  const fileList = document.getElementById("fileList");
  const fileItems = Array.from(fileList.children);
  const itemToRemove = fileItems.find((item) =>
    item.textContent.includes(fileName)
  );
  if (itemToRemove) {
    fileList.removeChild(itemToRemove);
  }
}

function getFileTypeIcon(fileName) {
  const extension = fileName.split(".").pop().toLowerCase();
  const iconUrls = {
    json: "https://cdn.jsdelivr.net/gh/PKief/vscode-material-icon-theme/icons/json.svg",
    ts: "https://cdn.jsdelivr.net/gh/PKief/vscode-material-icon-theme/icons/typescript.svg",
    html: "https://cdn.jsdelivr.net/gh/PKief/vscode-material-icon-theme/icons/html.svg",
    default:
      "https://cdn.jsdelivr.net/gh/PKief/vscode-material-icon-theme/icons/file.svg",
  };
  return iconUrls[extension] || iconUrls.default;
}

function autoGrow(element) {
  element.style.height = "5px";
  if (element.scrollHeight <= 150) {
    element.style.height = element.scrollHeight + "px";
  } else {
    element.style.height = "150px";
    element.style.overflowY = "auto";
  }
}

document.getElementById("userInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleAnalyzeAndChat();
  } else if (event.key === "Escape") {
    document.getElementById("userInput").value = "";
  }
});
