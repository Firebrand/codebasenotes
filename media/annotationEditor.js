(function() {
    const vscode = acquireVsCodeApi();
    const annotationTextarea = document.getElementById('annotation');
    const itemNameElement = document.getElementById('itemName');

    let debounceTimer;

    window.addEventListener('message', event => {
        const { type, itemName, annotation } = event.data;
        if (type === 'setAnnotation') {
            itemNameElement.textContent = itemName;
            annotationTextarea.value = annotation;
        }
    });

    annotationTextarea.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            vscode.postMessage({
                type: 'annotationUpdated',
                value: annotationTextarea.value
            });
        }, 300);
    });
})();