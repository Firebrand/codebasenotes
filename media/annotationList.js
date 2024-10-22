(function() {
    const vscode = acquireVsCodeApi();
    const annotationList = document.getElementById('annotationList');

    function renderAnnotations(annotations) {
        annotationList.innerHTML = '';
        annotations.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `${item.annotation}`;
            li.addEventListener('click', () => {
                vscode.postMessage({ type: 'revealItem', path: item.path });
            });
            annotationList.appendChild(li);
        });
    }

    renderAnnotations(annotations);

    window.addEventListener('message', event => {
        const message = event.data;
        console.log('Halako', message);
        switch (message.type) {
            case 'refreshAnnotations':
                renderAnnotations(message.annotations);
                break;
        }
    });
})();
