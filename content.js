// const observer = new MutationObserver(() => {
//   let content = document.body.innerText;
//   let prompt = document.getElementById("customPrompt").value.trim();
//   chrome.runtime.sendMessage({
//     action: "summarize",
//     text: content,
//     model: document.getElementById("modelSelect").value,
//     prompt: prompt
//   });
// });

// observer.observe(document.body, { childList: true, subtree: true });


class DomSelector {
    constructor() {
        this.selectionActive = false;
        this.selectedElement = null;
        this.currentElement = null;
        this.createFloatingPopup();
    }

    handleToggleMessage(message, sender, sendResponse) {
        if (message.action === "toggleDomSelector") {
            this.selectionActive = message.active;
            if (!this.selectionActive) {
                this.clearBoundary(this.selectedElement);
                this.selectedElement = null;
            }
        }
    }

    handleMouseOver(event) {
        if (!this.selectionActive) return;
        if (this.currentElement && this.currentElement !== this.selectedElement) {
            this.clearBoundary(this.currentElement);
        }
        
        if (this.currentElement !== event.target && this.selectedElement !== event.target) {
            this.currentElement = event.target;
            this.markHoverBoundary(this.currentElement);
        }
    }

    handleClick(event) {
        if (!this.selectionActive) return;
        event.preventDefault();

        if (this.selectedElement === event.target) {
            this.clearBoundary(this.selectedElement);
            this.selectedElement = null;
        } else {
            if (this.selectedElement) {
                this.clearBoundary(this.selectedElement);
            }
            this.selectedElement = event.target;
            this.markSelectedBoundary(this.selectedElement);

            const position = {
                x: event.clientX + window.scrollX,
                y: event.clientY + window.scrollY
            };
            
            console.log(position.x, position.y);
            

            this.showPopup(position, event.target.outerHTML);
        }
    }

    markSelectedBoundary(element) {
        element.removeAttribute("data-hovered");
        element.setAttribute("data-selected", "true"); // CSS가 자동 적용됨
    }
    
    markHoverBoundary(element) {
        element.setAttribute("data-hovered", "true"); // CSS가 자동 적용됨
    }
    
    clearBoundary(element) {
        if (element) {
            element.removeAttribute("data-selected");
            element.removeAttribute("data-hovered");
        }
    }


    createFloatingPopup() {
        this.popup = document.createElement("div");
        this.popup.style.position = "absolute";
        this.popup.style.display = "none";
        this.popup.style.background = "white";
        this.popup.style.border = "1px solid #ccc";
        this.popup.style.boxShadow = "0 2px 10px rgba(0,0,0,0.3)";
        this.popup.style.padding = "10px";
        this.popup.style.zIndex = "10000";
        this.popup.style.maxWidth = "300px";
        this.popup.innerHTML = `
            <div id="popup-content"></div>
            <button id="close-popup" style="margin-top:10px;">닫기</button>
        `;
        document.body.appendChild(this.popup);

        document.getElementById("close-popup").addEventListener("click", () => {
            this.popup.style.display = "none";
        });
    }

    // showPopup(position, htmlContent) {
    //     document.getElementById("popup-content").innerText = htmlContent;
    //     this.popup.style.left = `${position.x + 10}px`;
    //     this.popup.style.top = `${position.y + 10}px`;
    //     this.popup.style.display = "block";
    // }
    showPopup(position) {
        fetch(chrome.runtime.getURL("popup.html"))
            .then(response => response.text())
            .then(html => {
                document.getElementById("popup-content").innerHTML = html;
                this.popup.style.left = `${position.x + 10}px`;
                this.popup.style.top = `${position.y + 10}px`;
                this.popup.style.display = "block";
            }).catch(e => {
                debugger;
            });
    }
}

const domSelector = new DomSelector();

chrome.runtime.onMessage.addListener(domSelector.handleToggleMessage.bind(domSelector));

document.addEventListener("mouseover", domSelector.handleMouseOver.bind(domSelector));
document.addEventListener("click", domSelector.handleClick.bind(domSelector));
