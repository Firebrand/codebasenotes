(function() {
    const vscode = acquireVsCodeApi();
    const annotationList = document.getElementById('annotationList');

    function renderAnnotations() {
        annotationList.innerHTML = '';
        annotations.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${item.path}</strong>: ${item.annotation}`;
            li.addEventListener('click', () => {
                vscode.postMessage({ type: 'revealItem', path: item.path });
            });
            annotationList.appendChild(li);
        });
    }

    renderAnnotations();
})();
