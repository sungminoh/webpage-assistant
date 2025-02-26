export function ModelSelector({ models, selectedModel, onSelect }) {
    const handleChange = (e) => {
        const selected = models.find(model => model.name === e.target.value);
        onSelect(selected);
    };

    return (
        <select className="model-selector" value={selectedModel?.name || ''} onChange={handleChange}>
            {models.map((model) => (
                <option key={model.name} value={model.name}>
                    {model.name} ({model.type} - {model.inputPrice === 0 ? 'Free' : `$${model.inputPrice}/M`})
                </option>
            ))}
        </select>
    );
}