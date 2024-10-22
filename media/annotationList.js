(function() {
    const vscode = acquireVsCodeApi();
    const annotationList = document.getElementById('annotationList');

    function renderAnnotations(annotations) {
        annotationList.innerHTML = '';
        
        // Sort annotations based on the first two characters
        annotations.sort((a, b) => {
            const aNum = parseInt(a.annotation.substring(0, 2)) || Infinity;
            const bNum = parseInt(b.annotation.substring(0, 2)) || Infinity;
            return aNum - bNum;
        });

        annotations.forEach(item => {
            const li = document.createElement('li');
            const truncatedAnnotation = item.annotation.length > 100 
                ? item.annotation.substring(0, 100) + '...' 
                : item.annotation;
            li.innerHTML = `${truncatedAnnotation}`;
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
