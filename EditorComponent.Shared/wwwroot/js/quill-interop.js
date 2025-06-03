window.QuillInterop = {
    editors: {},
    clickHandlers: {},
    
    initializeQuill: function (editorId, dotNetReference, showToolbar) {
        setTimeout(() => {
            const container = document.getElementById(editorId);
            if (!container) {
                console.error(`Container with id ${editorId} not found`);
                return false;
            }

            const toolbarOptions = showToolbar ? [
                ['bold', 'italic', 'underline'],
                [{ 'header': [1, 2, 3, false] }],
                ['link', 'image'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['clean']
            ] : false;

            try {
                const quill = new Quill(`#${editorId}`, {
                    theme: 'snow',
                    modules: {
                        toolbar: toolbarOptions,
                        table: true
                    },
                    placeholder: 'Start typing...'
                });

                if (showToolbar) {
                    this.addTableButton(quill, editorId);
                }

                this.editors[editorId] = {
                    quill: quill,
                    dotNetReference: dotNetReference,
                    lastCursorPosition: 0
                };

                quill.on('text-change', function () {
                    const html = quill.root.innerHTML;
                    dotNetReference.invokeMethodAsync('UpdateValue', html);
                });

                quill.on('selection-change', function (range) {
                    if (range) {
                        window.QuillInterop.editors[editorId].lastCursorPosition = range.index;
                    }
                });

                // Handle editor click for popup
                const clickHandler = function (e) {
                    // Don't trigger if clicking on toolbar
                    if (e.target.closest('.ql-toolbar')) {
                        return;
                    }
                    dotNetReference.invokeMethodAsync('OnEditorClicked');
                };
                
                container.addEventListener('click', clickHandler);
                this.clickHandlers[editorId] = { container, handler: clickHandler };

                // Handle clicks outside editor
                const documentClickHandler = function (e) {
                    const editorContainer = document.getElementById(editorId);
                    if (editorContainer && !editorContainer.contains(e.target)) {
                        const popupElement = document.getElementById(`${editorId}-popup`);
                        if (popupElement && !popupElement.contains(e.target)) {
                            dotNetReference.invokeMethodAsync('OnClickOutside');
                        }
                    }
                };
                
                // Add with a slight delay to avoid initial trigger
                setTimeout(() => {
                    document.addEventListener('click', documentClickHandler);
                    window.QuillInterop.clickHandlers[editorId].documentHandler = documentClickHandler;
                }, 100);

                return true;
            } catch (error) {
                console.error('Error initializing Quill:', error);
                return false;
            }
        }, 50);
        
        return true;
    },

    addTableButton: function(quill, editorId) {
        const toolbar = quill.getModule('toolbar');
        const toolbarElement = quill.container.previousElementSibling;
        
        if (toolbarElement && toolbarElement.classList.contains('ql-toolbar')) {
            const tableButton = document.createElement('button');
            tableButton.className = 'ql-table-insert';
            tableButton.type = 'button';
            tableButton.innerHTML = '<svg viewBox="0 0 18 18">' +
                '<rect class="ql-stroke" height="12" width="12" x="3" y="3"></rect>' +
                '<rect class="ql-stroke" height="2" width="12" x="3" y="3"></rect>' +
                '<rect class="ql-stroke" height="2" width="2" x="3" y="3"></rect>' +
                '<rect class="ql-stroke" height="2" width="2" x="8" y="3"></rect>' +
                '<rect class="ql-stroke" height="7" width="2" x="3" y="8"></rect>' +
                '</svg>';
            tableButton.title = 'Insert Table';
            
            const lastGroup = toolbarElement.querySelector('.ql-formats:last-child');
            if (lastGroup) {
                lastGroup.appendChild(tableButton);
            } else {
                const newGroup = document.createElement('span');
                newGroup.className = 'ql-formats';
                newGroup.appendChild(tableButton);
                toolbarElement.appendChild(newGroup);
            }
            
            tableButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.showTablePicker(quill, editorId);
            });
        }
    },

    showTablePicker: function(quill, editorId) {
        const picker = document.createElement('div');
        picker.className = 'table-picker-popup';
        picker.innerHTML = `
            <div class="table-picker-header">Insert Table</div>
            <div class="table-picker-grid">
                ${this.createTableGrid()}
            </div>
            <div class="table-picker-info">1 x 1</div>
        `;
        
        const toolbar = quill.container.previousElementSibling;
        if (toolbar) {
            const rect = toolbar.getBoundingClientRect();
            picker.style.position = 'fixed';
            picker.style.top = `${rect.bottom + 5}px`;
            picker.style.left = `${rect.left}px`;
            picker.style.zIndex = '1001';
        }
        
        document.body.appendChild(picker);
        
        const cells = picker.querySelectorAll('.table-grid-cell');
        const info = picker.querySelector('.table-picker-info');
        
        cells.forEach(cell => {
            cell.addEventListener('mouseenter', (e) => {
                const row = parseInt(e.target.dataset.row);
                const col = parseInt(e.target.dataset.col);
                
                cells.forEach(c => {
                    const r = parseInt(c.dataset.row);
                    const cl = parseInt(c.dataset.col);
                    if (r <= row && cl <= col) {
                        c.classList.add('active');
                    } else {
                        c.classList.remove('active');
                    }
                });
                
                info.textContent = `${row} x ${col}`;
            });
            
            cell.addEventListener('click', (e) => {
                const rows = parseInt(e.target.dataset.row);
                const cols = parseInt(e.target.dataset.col);
                
                this.insertTable(quill, rows, cols);
                document.body.removeChild(picker);
            });
        });
        
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!picker.contains(e.target)) {
                    if (document.body.contains(picker)) {
                        document.body.removeChild(picker);
                    }
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    },

    createTableGrid: function() {
        let html = '';
        for (let row = 1; row <= 6; row++) {
            for (let col = 1; col <= 6; col++) {
                html += `<div class="table-grid-cell" data-row="${row}" data-col="${col}"></div>`;
            }
        }
        return html;
    },

    insertTable: function(quill, rows, cols) {
        const range = quill.getSelection() || { index: 0 };
        
        let tableHtml = '<table>';
        for (let r = 0; r < rows; r++) {
            tableHtml += '<tr>';
            for (let c = 0; c < cols; c++) {
                tableHtml += '<td><br></td>';
            }
            tableHtml += '</tr>';
        }
        tableHtml += '</table>';
        
        quill.clipboard.dangerouslyPasteHTML(range.index, tableHtml);
        
        quill.setSelection(range.index + 1, 0);
    },

    getContent: function (editorId) {
        const editor = this.editors[editorId];
        if (editor && editor.quill) {
            return editor.quill.root.innerHTML;
        }
        return '';
    },

    setContent: function (editorId, content) {
        const editor = this.editors[editorId];
        if (editor && editor.quill) {
            editor.quill.root.innerHTML = content || '';
        }
    },

    insertTextAtCursor: function (editorId, text) {
        const editor = this.editors[editorId];
        if (editor && editor.quill) {
            const position = editor.lastCursorPosition || 0;
            editor.quill.insertText(position, text);
            
            const newPosition = position + text.length;
            editor.quill.setSelection(newPosition, 0);
            editor.lastCursorPosition = newPosition;
        }
    },

    getCursorPosition: function (editorId) {
        const editor = this.editors[editorId];
        if (editor && editor.quill) {
            const range = editor.quill.getSelection();
            return range ? range.index : editor.lastCursorPosition || 0;
        }
        return 0;
    },

    focus: function (editorId) {
        const editor = this.editors[editorId];
        if (editor && editor.quill) {
            editor.quill.focus();
        }
    },

    positionPopup: function (editorId, popupId) {
        const editorElement = document.getElementById(editorId);
        const popupElement = document.getElementById(popupId);
        
        if (editorElement && popupElement) {
            const rect = editorElement.getBoundingClientRect();
            popupElement.style.position = 'fixed';
            popupElement.style.top = `${rect.top + 50}px`;
            popupElement.style.left = `${rect.left}px`;
            popupElement.style.zIndex = '1000';
        }
    },

    dispose: function (editorId) {
        try {
            const editor = this.editors[editorId];
            if (editor) {
                const handlers = this.clickHandlers[editorId];
                if (handlers) {
                    if (handlers.container && handlers.handler) {
                        handlers.container.removeEventListener('click', handlers.handler);
                    }
                    if (handlers.documentHandler) {
                        document.removeEventListener('click', handlers.documentHandler);
                    }
                    delete this.clickHandlers[editorId];
                }
                
                delete this.editors[editorId];
            }
        } catch (error) {
            console.error('Error disposing editor:', error);
        }
    }
}; 