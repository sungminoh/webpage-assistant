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
