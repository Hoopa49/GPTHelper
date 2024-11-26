import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export function activate(context: vscode.ExtensionContext) {
  if (!context.subscriptions) {
    console.error(
      "Контекст расширения не найден или подписки не инициализированы."
    );
    return;
  }

  console.log("Активировано расширение ChatGPT Helper");

  const viewProvider = new ChatGPTViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatGPTViewProvider.viewType,
      viewProvider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      }
    )
  );

  console.log("ChatGPTViewProvider зарегистрирован");
}

class ChatGPTViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "chatgpt-helper.chatgptView";
  private _view?: vscode.WebviewView;
  private selectedFiles: vscode.Uri[] = [];

  constructor(private readonly _context: vscode.ExtensionContext) {
    console.log("Создан ChatGPTViewProvider");
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log("Инициализация Webview началась");
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, "resources"),
      ],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView);
    console.log("HTML успешно передан Webview");

    webviewView.webview.onDidReceiveMessage((message) =>
      this.handleWebviewMessage(message)
    );
  }

  private getHtmlContent(webviewView: vscode.WebviewView): string {
    const htmlPath = vscode.Uri.joinPath(
      this._context.extensionUri,
      "resources",
      "chatgpt-helper.html"
    );
    let htmlContent = fs.readFileSync(htmlPath.fsPath, "utf8");

    const resourceUris = {
      chatgptHelperCssUri: webviewView.webview.asWebviewUri(
        vscode.Uri.joinPath(
          this._context.extensionUri,
          "resources",
          "chatgpt-helper.css"
        )
      ),
      chatgptHelperJsUri: webviewView.webview.asWebviewUri(
        vscode.Uri.joinPath(
          this._context.extensionUri,
          "resources",
          "chatgpt-helper.js"
        )
      ),
      attachIconUri: webviewView.webview.asWebviewUri(
        vscode.Uri.file(
          path.join(this._context.extensionPath, "resources", "attach.svg")
        )
      ),
      deleteIconUri: webviewView.webview.asWebviewUri(
        vscode.Uri.file(
          path.join(this._context.extensionPath, "resources", "delete.svg")
        )
      ),
      playIconUri: webviewView.webview.asWebviewUri(
        vscode.Uri.file(
          path.join(this._context.extensionPath, "resources", "play.png")
        )
      ),
    };

    for (const [key, uri] of Object.entries(resourceUris)) {
      htmlContent = htmlContent.replace(`{{${key}}}`, uri.toString());
    }

    return htmlContent;
  }

  private async handleWebviewMessage(message: any) {
    switch (message.type) {
      case "analyzeAndChat":
        return this.processChatRequest(message);
      case "selectFiles":
        return this.selectFilesHandler();
      case "removeFile":
        return this.removeFileHandler(message.index);
      default:
        console.error(`Неизвестный тип сообщения: ${message.type}`);
    }
  }

  private async processChatRequest(message: any) {
    if (!message.text) return;

    console.log(`Получен запрос от пользователя: ${message.text}`);

    try {
      const repositoryContent = this.analyzeSelectedFiles(this.selectedFiles);
      let prompt = `Вот содержимое выбранных файлов:\n${repositoryContent}\n\nТеперь ответь на следующий вопрос:\n${message.text}`;

      if (prompt.length > 4096) {
        console.warn("Prompt слишком длинный, сокращаем до 4096 символов.");
        prompt = prompt.substring(0, 4096);
      }

      const response = await this.getChatGPTResponse(prompt);
      console.log(`Ответ от ChatGPT: ${response}`);

      this._view?.webview.postMessage({
        type: "chatgptResponse",
        text: response,
      });
    } catch (error) {
      console.error("Ошибка при запросе к OpenAI API:", error);
      this._view?.webview.postMessage({
        type: "chatgptResponse",
        text: "Ошибка при запросе к OpenAI API",
      });
    }
  }

  private async selectFilesHandler() {
    try {
      this.selectedFiles = await this.selectFiles();
      console.log("Выбранные файлы:", this.selectedFiles);
      this._view?.webview.postMessage({
        type: "selectedFiles",
        files: this.selectedFiles.map((file) => file.fsPath),
      });
    } catch (error) {
      console.error("Ошибка при выборе файлов:", error);
    }
  }

  private removeFileHandler(index: number) {
    if (index >= 0 && index < this.selectedFiles.length) {
      this.selectedFiles.splice(index, 1);
      console.log(
        "Файл удалён, обновлённый список файлов:",
        this.selectedFiles
      );
      this._view?.webview.postMessage({
        type: "selectedFiles",
        files: this.selectedFiles.map((file) => file.fsPath),
      });
    } else {
      console.error("Неверный индекс файла для удаления:", index);
    }
  }

  private async selectFiles(): Promise<vscode.Uri[]> {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: true,
      openLabel: "Выберите файлы",
      canSelectFiles: true,
      canSelectFolders: false,
    };
    return (await vscode.window.showOpenDialog(options)) || [];
  }

  private analyzeSelectedFiles(files: vscode.Uri[]): string {
    return files
      .map((file) => {
        const filePath = file.fsPath;
        try {
          if (fs.statSync(filePath).isFile()) {
            const fileContent = fs.readFileSync(filePath, "utf8");
            return `\n--- [Файл] ${path.basename(filePath)} ---\n${
              fileContent.length > 1000
                ? `${fileContent.substring(
                    0,
                    1000
                  )}\n...\n[Содержимое файла сокращено]\n`
                : fileContent
            }`;
          }
        } catch (error) {
          console.error(`Ошибка при чтении файла ${filePath}:`, error);
          return "[Ошибка при чтении файла]\n";
        }
        return "";
      })
      .join("\n");
  }

  private async getChatGPTResponse(prompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("API ключ для OpenAI не найден.");
      return "API ключ не найден. Проверьте ваш файл .env.";
    }

    const fetch = (await import("node-fetch")).default;
    const url = "https://api.openai.com/v1/chat/completions";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: prompt },
          ],
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        console.error(
          "Ошибка при запросе к OpenAI API. Код ответа:",
          response.status,
          response.statusText
        );
        return `Ошибка при запросе к OpenAI API: ${response.statusText}`;
      }

      const data: any = await response.json();
      return data.choices?.[0]?.message.content.trim() ?? "Нет ответа.";
    } catch (error) {
      console.error("Ошибка при выполнении запроса к OpenAI API:", error);
      return "Ошибка при выполнении запроса к OpenAI API.";
    }
  }
}

export function deactivate() {
  console.log("Деактивация ChatGPT Helper");
}
