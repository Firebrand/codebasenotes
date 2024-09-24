(function() {
    const vscode = acquireVsCodeApi();
    const annotationTextarea = document.getElementById('annotation');
    const itemNameElement = document.getElementById('itemName');

    let debounceTimer;

    window.addEventListener('message', event => {
        const message = event.data;
        try {
            switch (message.type) {
                case 'setAnnotation':
                    itemNameElement.textContent = message.itemName;
                    annotationTextarea.value = message.annotation;
                    break;
                default:
                    console.warn(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            console.error('Error processing message:', error);
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
}());