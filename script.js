// DOM Elements
const fileDropArea = document.getElementById('file-drop-area');
const fileInput = document.getElementById('file-input');
const selectedFilesList = document.getElementById('selected-files-list');
const fileCountDisplay = document.getElementById('file-count');
const mergeBtn = document.getElementById('merge-btn');
const resetBtn = document.getElementById('reset-btn');
const resultSection = document.getElementById('result');
const downloadLink = document.getElementById('download-link');
const notificationContainer = document.getElementById('notification-container');
const toggler = document.getElementById('toggler');
const body = document.querySelector("body")

// Global variables
const MAX_FILES = 3;
let selectedFiles = [];
let mergedPdfUrl = null;
let notificationTimeout = null;
let theme = 'light'

//Handle theme toggle
toggler.addEventListener('click', () => {
    if (theme == 'light') {
        toggler.classList.remove('fa-moon')
        toggler.classList.add('fa-sun')
        body.classList.add('dark')
        theme = "dark"
    } else {
        toggler.classList.remove('fa-sun')
        toggler.classList.add('fa-moon')
        body.classList.remove("dark")
        theme = "light"
    }
})

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // File input change event
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop events
    fileDropArea.addEventListener('dragover', handleDragOver);
    fileDropArea.addEventListener('dragleave', handleDragLeave);
    fileDropArea.addEventListener('drop', handleDrop);

    // Button events
    mergeBtn.addEventListener('click', mergePDFs);
    resetBtn.addEventListener('click', resetApp);
});

// Handle file selection from input
function handleFileSelect(e) {
    const files = e.target.files;
    
    if (files.length > 0) {
        addFiles(files);
    }
    
    // Reset the file input to allow selecting the same file again
    fileInput.value = '';
}

// Handle drag over event
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    fileDropArea.classList.add('highlight');
}

// Handle drag leave event
function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    fileDropArea.classList.remove('highlight');
}

// Handle drop event
function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    fileDropArea.classList.remove('highlight');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        addFiles(files);
    }
}

// Add files to the selected files list
function addFiles(files) {
    const filesToAdd = Array.from(files);
    
    // Filter for PDF files only
    const pdfFiles = filesToAdd.filter(file => {
        const isPdf = file.type === 'application/pdf';
        if (!isPdf) {
            showNotification('Only PDF files are supported', 'error');
        }
        return isPdf;
    });
    
    // Check if adding these files would exceed the maximum
    if (selectedFiles.length + pdfFiles.length > MAX_FILES) {
        showNotification(`You can select a maximum of ${MAX_FILES} files`, 'error');
        // Only add files up to the maximum
        pdfFiles.splice(0, MAX_FILES - selectedFiles.length);
    }
    
    // Add files to our array
    pdfFiles.forEach(file => {
        // Check if file is already in the list
        const isDuplicate = selectedFiles.some(existingFile => 
            existingFile.name === file.name && existingFile.size === file.size
        );
        
        if (!isDuplicate) {
            selectedFiles.push(file);
        }
    });
    
    // Update UI
    updateFileList();
    updateButtonStates();
}

// Update the file list in the UI
function updateFileList() {
    // Clear the list
    selectedFilesList.innerHTML = '';
    
    // Add each file to the list
    selectedFiles.forEach((file, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'file-item';
        listItem.innerHTML = `
            <div class="file-info">
                <i class="fas fa-file-pdf file-icon"></i>
                <span class="file-name">${file.name}</span>
            </div>
            <div class="file-actions">
                <button class="move-file move-up" ${index === 0 ? 'disabled' : ''} title="Move Up">
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="move-file move-down" ${index === selectedFiles.length - 1 ? 'disabled' : ''} title="Move Down">
                    <i class="fas fa-arrow-down"></i>
                </button>
                <button class="remove-file" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add event listeners for buttons
        const moveUpBtn = listItem.querySelector('.move-up');
        const moveDownBtn = listItem.querySelector('.move-down');
        const removeBtn = listItem.querySelector('.remove-file');
        
        moveUpBtn.addEventListener('click', () => moveFile(index, 'up'));
        moveDownBtn.addEventListener('click', () => moveFile(index, 'down'));
        removeBtn.addEventListener('click', () => removeFile(index));
        
        selectedFilesList.appendChild(listItem);
    });
    
    // Update file count
    fileCountDisplay.textContent = `(${selectedFiles.length}/${MAX_FILES})`;
}

// Move a file up or down in the list
function moveFile(index, direction) {
    if (direction === 'up' && index > 0) {
        // Swap with the file above
        [selectedFiles[index], selectedFiles[index - 1]] = [selectedFiles[index - 1], selectedFiles[index]];
    } else if (direction === 'down' && index < selectedFiles.length - 1) {
        // Swap with the file below
        [selectedFiles[index], selectedFiles[index + 1]] = [selectedFiles[index + 1], selectedFiles[index]];
    }
    
    // Update UI
    updateFileList();
}

// Remove a file from the list
function removeFile(index) {
    selectedFiles.splice(index, 1);
    
    // Update UI
    updateFileList();
    updateButtonStates();
    
    // Clean up any existing merged PDF URL
    cleanupMergedPdf();
}

// Update the merge and reset button states
function updateButtonStates() {
    mergeBtn.disabled = selectedFiles.length < 2;
    resetBtn.disabled = selectedFiles.length === 0;
}

// Reset the application
function resetApp() {
    selectedFiles = [];
    updateFileList();
    updateButtonStates();
    resultSection.classList.add('hidden');
    cleanupMergedPdf();
}

// Clean up merged PDF URL
function cleanupMergedPdf() {
    if (mergedPdfUrl) {
        URL.revokeObjectURL(mergedPdfUrl);
        mergedPdfUrl = null;
    }
}

// Merge PDFs
async function mergePDFs() {
    if (selectedFiles.length < 2) {
        showNotification('Please select at least 2 PDF files to merge', 'error');
        return;
    }
    
    try {
        // Show loading state
        mergeBtn.disabled = true;
        mergeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        // Create a new PDF document
        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();
        
        // Process each selected file
        for (const file of selectedFiles) {
            try {
                // Read the file as an ArrayBuffer
                const fileArrayBuffer = await readFileAsArrayBuffer(file);
                
                // Load the PDF document
                const pdfDoc = await PDFDocument.load(fileArrayBuffer);
                
                // Get all pages from the document
                const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                
                // Add each page to our merged PDF
                for (const page of pages) {
                    mergedPdf.addPage(page);
                }
            } catch (err) {
                console.error(`Error processing file ${file.name}:`, err);
                showNotification(`Error processing ${file.name}. It may be corrupted or password-protected.`, 'error');
                
                // Reset merge button state
                mergeBtn.disabled = false;
                mergeBtn.innerHTML = 'Merge PDFs';
                return;
            }
        }
        
        // Save the merged PDF
        const mergedPdfBytes = await mergedPdf.save();
        
        // Create a blob and URL for the merged PDF
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        
        // Clean up any existing URL
        cleanupMergedPdf();
        
        // Create a new URL for the blob
        mergedPdfUrl = URL.createObjectURL(blob);
        
        // Set the download link
        downloadLink.href = mergedPdfUrl;
        
        // Generate a filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        downloadLink.download = `merged-pdf-${timestamp}.pdf`;
        
        // Show result section
        resultSection.classList.remove('hidden');
        
        // Reset merge button state
        mergeBtn.disabled = false;
        mergeBtn.innerHTML = 'Merge PDFs';
        
        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth' });
        
        showNotification('PDFs merged successfully!', 'success');
    } catch (error) {
        console.error('Error merging PDFs:', error);
        showNotification('An error occurred while merging the PDFs', 'error');
        
        // Reset merge button state
        mergeBtn.disabled = false;
        mergeBtn.innerHTML = 'Merge PDFs';
    }
}

// Read a file as ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Show custom notification
function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Create notification content
    const notificationContent = document.createElement('div');
    notificationContent.className = 'notification-content';
    
    // Add icon based on notification type
    const icon = document.createElement('div');
    icon.className = 'notification-icon';
    icon.innerHTML = type === 'success' 
        ? '<i class="fas fa-check-circle"></i>' 
        : '<i class="fas fa-exclamation-circle"></i>';
    
    // Add message
    const messageElement = document.createElement('div');
    messageElement.className = 'notification-message';
    messageElement.textContent = message;
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.addEventListener('click', () => removeNotification(notification));
    
    // Add progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'notification-progress';
    
    // Assemble notification
    notificationContent.appendChild(icon);
    notificationContent.appendChild(messageElement);
    notification.appendChild(notificationContent);
    notification.appendChild(closeBtn);
    notification.appendChild(progressBar);
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Set timeout to remove notification
    const timeout = setTimeout(() => {
        removeNotification(notification);
    }, 5000);
    
    // Store timeout ID to allow cancellation
    notification.dataset.timeoutId = timeout;
    
    return notification;
}

// Remove a notification
function removeNotification(notification) {
    // Clear the timeout if it exists
    if (notification.dataset.timeoutId) {
        clearTimeout(parseInt(notification.dataset.timeoutId));
    }
    
    // Add animation class
    notification.style.animation = 'slideOut 0.3s forwards';
    
    // Remove after animation completes
    setTimeout(() => {
        if (notification.parentElement) {
            notification.parentElement.removeChild(notification);
        }
    }, 300);
}