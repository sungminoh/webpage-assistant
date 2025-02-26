import { useState, useEffect, createContext, useContext } from 'react';
import { StorageHelper } from './storageHelper';
import { injectScript } from './utils/scriptUtils';

const MODELS = require('../public/models.json')

export function useChat() {
    const [chatHistory, setChatHistory] = useState([]);

    // Load chat history from storage
    useEffect(() => {
        StorageHelper.get(['chatHistory', 'chatScrollPosition']).then(({ chatHistory = [] }) => {
            setChatHistory(chatHistory);
        });
    }, []);

    // Save chat history to storage
    useEffect(() => {
        StorageHelper.set({ chatHistory });
    }, [chatHistory]);

    // Handle messages from background script
    useEffect(() => {
        const handleMessage = (message) => {
            if (message.action === 'stream_update') {
                const { chunk, id } = message;
                setChatHistory((prev) => {
                    return prev.map((msg) => {
                        if (msg.sender === 'AI' && msg.id === id) {
                            if (msg.isPlaceholder) {
                                return { ...msg, text: chunk, usage, isPlaceholder: false };
                            }
                            return { ...msg, text: msg.text + chunk };
                        }
                        return msg;
                    });
                });
            } else if (message.action === 'response_result') {
                const { response, id } = message;
                setChatHistory((prev) => {
                    return prev.map((msg) => {
                        if (msg.sender === 'AI' && msg.id === id) {
                            const { content, inputTokens, outputTokens } = response;
                            let usage = null;
                            if (inputTokens != null && outputTokens != null) {
                                const { inputPrice, outputPrice } = message.request.model;
                                const totalPrice = ((inputPrice * inputTokens) + (outputPrice * outputTokens)) / 1000000;
                                usage = { inputTokens, outputTokens, totalPrice };
                            }
                            return { ...msg, text: content, usage, isPlaceholder: false };
                        }
                        return msg;
                    });
                });
            }
        };
        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, []);

    const addMessage = (sender, text, usage = null, isPlaceholder = false) => {
        const id = Date.now().toString(); // Simple unique ID; consider UUID for production
        setChatHistory((prev) => [
            ...prev,
            { id, sender, text: text?.trim(), usage, isPlaceholder }]);
        return id;
    };

    const clearChat = () => {
        setChatHistory([]);
        StorageHelper.remove(['chatHistory', 'chatScrollPosition']);
    };

    return { chatHistory, addMessage, clearChat };
}



export function useDomSelection() {
    const [active, setActive] = useState(false);
    const [selectedHTML, setSelectedHTML] = useState('');
    // A flag to ensure we only update storage after we've loaded the initial values
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        injectScript(3000);
        // Load initial state from storage
        StorageHelper.get('domSelection').then(async ({ domSelection }) => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const storedData = domSelection?.[tab.id];
            if (storedData) {
                setActive(storedData.active || false);
                setSelectedHTML(storedData.html || "");
            }
            // Mark that we've loaded from storage
            setLoaded(true);
        });
        const handleMessage = (message, sender, sendMessage) => {
            if (message.action === 'change_selected_dom') {
                setSelectedHTML(message.html);
            }
        };
        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, []);

    useEffect(() => {
        // Only update storage once we have loaded the stored values
        // This prevents overwriting a stored "true" with the default "false"
        if (!loaded) return;

        async function updateStorage() {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await StorageHelper.update({ domSelection: { [tab.id]: { active } } });
        }
    }, [active, loaded]);

    const toggle = () => {
        setActive((prev) => {
            const newActive = !prev;
            if (newActive) {
                window.close();
            }
            return newActive;
        });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle_dom_selector' });
        });
    };

    return { selectModeActive: active, selectedHTML, toggleSelectMode: toggle };
}


export function useModels() {
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState();

    useEffect(() => {
        const loadModels = async () => {
            // const ollamaModels = await fetchOllamaModels();
            const allModels = [
                ...MODELS.openai_models,
                ...MODELS.gemini_models,
                ...MODELS.anthropic_models,
                // ...ollamaModels
            ];
            // Set the default selectedModel to the first model if none is stored
            StorageHelper.get('selectedModel', 'sync').then(({ selectedModel: storedModel }) => {
                if (storedModel) {
                    setSelectedModel(storedModel);
                } else if (allModels.length > 0) {
                    setSelectedModel(allModels[0]);
                }
            });
            setModels(allModels);
        };
        loadModels();
    }, []);

    useEffect(() => {
        if (selectedModel) {
            StorageHelper.set({ selectedModel }, "sync")
        };
    }, [selectedModel]);

    const fetchOllamaModels = async () => {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            const data = await response.json();
            return data.models.map((m) => ({ type: 'ollama', name: m.name, inputPrice: 0, outputPrice: 0 }));
        } catch (error) {
            console.warn('Error fetching Ollama models:', error);
            return [];
        }
    };

    return { models, selectedModel, setSelectedModel };
}





export function usePrompts() {
    const [prompts, setPrompts] = useState([]);

    useEffect(() => {
        StorageHelper.get('savedPrompts', 'sync').then(({ savedPrompts = [] }) => {
            setPrompts(savedPrompts);
        });
    }, []);

    useEffect(() => {
        StorageHelper.set({ savedPrompts: prompts }, 'sync');
    }, [prompts]);

    const addPrompt = (prompt) => setPrompts((prev) => [...prev, prompt]);
    const removePrompt = (index) => setPrompts((prev) => prev.filter((_, i) => i !== index));
    const reorderPrompts = (fromIndex, toIndex) => {
        setPrompts((prev) => {
            const newPrompts = [...prev];
            const [moved] = newPrompts.splice(fromIndex, 1);
            newPrompts.splice(toIndex, 0, moved);
            return newPrompts;
        });
    };

    return { prompts, addPrompt, removePrompt, reorderPrompts };
}



const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState('light');

    useEffect(() => {
        StorageHelper.get('theme').then(({ theme }) => {
            if (theme) setTheme(theme);
        });
    }, []);

    useEffect(() => {
        StorageHelper.set({ theme }, "sync");
    }, [theme]);

    const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);