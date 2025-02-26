import { useState, useEffect } from 'react';
import { StorageHelper } from './storageHelper';
import { marked } from "marked";
import TurndownService from 'turndown';

const turndownService = new TurndownService();

export function DomSelector({ selectedHTML }) {
  const [htmlMode, setHtmlMode] = useState('html');

  useEffect(() => {
    StorageHelper.get('htmlMode').then(({ htmlMode = 'html' }) => setHtmlMode(htmlMode));
  }, []);

  useEffect(() => {
    StorageHelper.set({ htmlMode }, "sync");
  }, [htmlMode]);

  const content = htmlMode === 'markdown' ? turndownService.turndown(selectedHTML) : selectedHTML;

  return (
    <div className="dom-selector">
      <div>
        <button onClick={() => setHtmlMode('html')}>HTML</button>
        <button onClick={() => setHtmlMode('markdown')}>Markdown</button>
      </div>
      <div
        dangerouslySetInnerHTML={{
          __html: htmlMode === 'markdown' ? marked.parse(content) : content,
        }}
      />
    </div>
  );
}