export function SettingsButton() {
    return <button onClick={() => chrome.runtime.openOptionsPage()}>Settings</button>;
  }