const API_URL = window.location.origin + '/api';
let currentSku = null;
let selectedPack = null;
let codeReader = null;
let currentStream = null;

// Elementos DOM
const skuInput = document.getElementById('skuInput');
const scanBtn = document.getElementById('scanBtn');
const scanCameraBtn = document.getElementById('scanCameraBtn');
const cameraContainer = document.getElementById('cameraContainer');
const video = document.getElementById('video');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const formContainer = document.getElementById('formContainer');
const displaySku = document.getElementById('displaySku');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const statusDiv = document.getElementById('status');

// Verificar SKU manual
scanBtn.onclick = async () => {
    const sku = skuInput.value.trim();
    if (!sku) {
        showStatus('Ingresa un SKU', 'error');
        return;
    }
    await verificarSku(sku);
};

// Abrir cámara trasera para escanear
scanCameraBtn.onclick = async () => {
    await iniciarCamaraTrasera();
};

// Cerrar cámara
closeCameraBtn.onclick = () => {
    detenerCamara();
};

// Iniciar SOLO cámara trasera
async function iniciarCamaraTrasera() {
    try {
        cameraContainer.style.display = 'block';
        
        // Configuración para forzar cámara trasera
        const constraints = {
            video: {
                facingMode: { exact: "environment" }  // Fuerza cámara trasera
            }
        };
        
        // Intentar obtener cámara trasera directamente
        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = currentStream;
            await video.play();
            
            // Inicializar lector SOLO para códigos de barras (excluir QR)
            codeReader = new ZXing.BrowserMultiFormatReader();
            
            // Escanear continuamente
            scanBarcode();
            
        } catch (err) {
            // Si falla "environment", intentar con facingMode normal y buscar trasera manualmente
            console.log("No se pudo obtener cámara trasera directamente, buscando manualmente...");
            await buscarCamaraTraseraManual();
        }
        
    } catch (error) {
        console.error('Error al iniciar cámara:', error);
        showStatus('Error al acceder a la cámara. Verifica los permisos.', 'error');
        detenerCamara();
    }
}

// Método alternativo para encontrar la cámara trasera
async function buscarCamaraTraseraManual() {
    try {
        // Obtener todos los dispositivos de video
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        // Buscar cámara trasera (usualmente contiene "back", "environment", "rear")
        let backCamera = videoDevices.find(device => 
            device.label.toLowerCase().includes('back') ||
            device.label.toLowerCase().includes('environment') ||
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('trasera')
        );
        
        // Si no encuentra trasera, usar la primera cámara
        if (!backCamera && videoDevices.length > 0) {
            backCamera = videoDevices[0];
            showStatus('Usando cámara predeterminada', '');
        }
        
        if (!backCamera) {
            throw new Error('No se encontró cámara');
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: backCamera.deviceId } }
        });
        
        currentStream = stream;
        video.srcObject = currentStream;
        await video.play();
        
        codeReader = new ZXing.BrowserMultiFormatReader();
        scanBarcode();
        
    } catch (error) {
        console.error('Error al buscar cámara trasera:', error);
        showStatus('No se pudo acceder a la cámara trasera', 'error');
        detenerCamara();
    }
}

// Escanear SOLO códigos de barras (ignorar QR)
function scanBarcode() {
    if (!codeReader || !video.srcObject) return;
    
    // Configurar para leer solo códigos de barras
    // ZXing intenta con todos los formatos, pero solo procesamos si es código de barras
    codeReader.decodeFromVideoElement(video, (result, err) => {
        if (result) {
            const text = result.text;
            const format = result.format;
            
            // Lista de formatos que son códigos de barras (excluir QR)
            const barcodeFormats = [
                'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 
                'CODE_39', 'CODE_93', 'CODE_128', 'CODABAR',
                'ITF', 'RSS_14', 'RSS_EXPANDED'
            ];
            
            // Verificar si es un código de barras (no QR)
            const isBarcode = barcodeFormats.includes(format) || 
                              !format?.includes('QR');  // Si el formato no contiene QR
            
            if (isBarcode && text && text.length > 0) {
                detenerCamara();
                skuInput.value = text;
                verificarSku(text);
            } else if (format?.includes('QR')) {
                // Si es QR, ignorar y mostrar mensaje
                showStatus('📱 Por favor escanea el código de BARRAS, no el QR', 'error');
            }
        }
    });
}

// Detener cámara
function detenerCamara() {
    if (codeReader) {
        try {
            codeReader.reset();
        } catch(e) {}
        codeReader = null;
    }
    
    if (currentStream) {
        currentStream.getTracks().forEach(track => {
            track.stop();
        });
        currentStream = null;
    }
    
    if (video.srcObject) {
        video.srcObject = null;
    }
    
    cameraContainer.style.display = 'none';
}

// Verificar SKU con el backend
async function verificarSku(sku) {
    showStatus('Buscando...', '');
    
    try {
        const res = await fetch(`${API_URL}/producto/${encodeURIComponent(sku)}`);
        const data = await res.json();
        
        if (data.exists) {
            showAlert(data.producto);
        } else {
            showForm(sku);
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error de conexión con el servidor', 'error');
    }
}

// Guardar producto
saveBtn.onclick = async () => {
    const alto = parseFloat(document.getElementById('alto').value);
    const ancho = parseFloat(document.getElementById('ancho').value);
    const largo = parseFloat(document.getElementById('largo').value);
    
    if (!selectedPack) {
        showStatus('Selecciona tipo de empaque', 'error');
        return;
    }
    
    if (isNaN(alto) || isNaN(ancho) || isNaN(largo)) {
        showStatus('Ingresa todas las medidas', 'error');
        return;
    }
    
    if (alto <= 0 || ancho <= 0 || largo <= 0) {
        showStatus('Las medidas deben ser mayores a 0', 'error');
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/productos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sku: currentSku,
                alto, ancho, largo,
                tipo_empaque: selectedPack
            })
        });
        
        if (res.ok) {
            showStatus('✅ Producto guardado!', 'success');
            setTimeout(() => {
                formContainer.style.display = 'none';
                skuInput.value = '';
                skuInput.focus();
                resetForm();
            }, 1500);
        } else {
            const error = await res.json();
            showStatus(error.error || 'Error al guardar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error al guardar', 'error');
    }
};

cancelBtn.onclick = () => {
    formContainer.style.display = 'none';
    skuInput.value = '';
    skuInput.focus();
    resetForm();
};

// Selección de tipo de empaque
document.querySelectorAll('.packBtn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.packBtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPack = btn.dataset.pack;
    };
});

function showForm(sku) {
    formContainer.style.display = 'block';
    displaySku.textContent = sku;
    currentSku = sku;
    statusDiv.innerHTML = '';
    skuInput.value = '';
    formContainer.scrollIntoView({ behavior: 'smooth' });
}

function showAlert(producto) {
    const modal = document.getElementById('alertModal');
    const details = document.getElementById('alertDetails');
    const tipoTexto = { caja: '📦 Caja', bolsa: '🛍️ Bolsa', ninguno: '📦 Sin empaque' };
    
    details.innerHTML = `
        <p><strong>SKU:</strong> ${producto.sku}</p>
        <p><strong>Medidas:</strong> ${producto.alto} x ${producto.ancho} x ${producto.largo} cm</p>
        <p><strong>Empaque:</strong> ${tipoTexto[producto.tipo_empaque] || producto.tipo_empaque}</p>
        <p><strong>Registrado:</strong> ${new Date(producto.fecha_registro).toLocaleDateString()}</p>
    `;
    modal.style.display = 'flex';
    skuInput.value = '';
}

function showStatus(msg, type) {
    statusDiv.innerHTML = msg;
    statusDiv.className = `status ${type}`;
    if (msg && type !== 'error') {
        setTimeout(() => {
            if (statusDiv.innerHTML === msg) {
                statusDiv.innerHTML = '';
                statusDiv.className = 'status';
            }
        }, 3000);
    }
}

function resetForm() {
    document.getElementById('alto').value = '';
    document.getElementById('ancho').value = '';
    document.getElementById('largo').value = '';
    document.querySelectorAll('.packBtn').forEach(b => b.classList.remove('active'));
    selectedPack = null;
    currentSku = null;
}

window.closeModal = () => {
    document.getElementById('alertModal').style.display = 'none';
    skuInput.focus();
};

skuInput.focus();
