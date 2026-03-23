const API_URL = window.location.origin + '/api';
let currentSku = null;
let selectedPack = null;
let currentStream = null;
let scanningActive = false;

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

// Abrir cámara trasera
scanCameraBtn.onclick = async () => {
    await iniciarCamaraTrasera();
};

// Cerrar cámara
closeCameraBtn.onclick = () => {
    detenerCamara();
};

// Iniciar cámara trasera
async function iniciarCamaraTrasera() {
    try {
        cameraContainer.style.display = 'block';
        scanningActive = true;
        
        // Configuración para cámara trasera
        const constraints = {
            video: { facingMode: { exact: "environment" } }
        };
        
        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = currentStream;
            await video.play();
            showStatus('Cámara activa. Apunta al código de barras.', '');
            iniciarEscaner();
        } catch (err) {
            // Si falla, buscar cámara trasera manualmente
            await buscarCamaraTraseraManual();
        }
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error al acceder a la cámara. Verifica los permisos.', 'error');
        detenerCamara();
    }
}

// Buscar cámara trasera manualmente
async function buscarCamaraTraseraManual() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        // Buscar cámara trasera
        let backCamera = videoDevices.find(device => 
            device.label.toLowerCase().includes('back') ||
            device.label.toLowerCase().includes('environment') ||
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('trasera') ||
            device.label.toLowerCase().includes('cámara trasera')
        );
        
        if (!backCamera && videoDevices.length > 0) {
            backCamera = videoDevices[0];
        }
        
        if (!backCamera) {
            throw new Error('No se encontró cámara');
        }
        
        currentStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: backCamera.deviceId } }
        });
        
        video.srcObject = currentStream;
        await video.play();
        showStatus('Cámara trasera activa. Apunta al código de barras.', '');
        iniciarEscaner();
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('No se pudo acceder a la cámara trasera', 'error');
        detenerCamara();
    }
}

// Iniciar escáner
function iniciarEscaner() {
    if (!video.srcObject) return;
    
    // Crear canvas para capturar frames
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    function capturarFrame() {
        if (!scanningActive || !video.videoWidth || !video.videoHeight) {
            if (scanningActive) requestAnimationFrame(capturarFrame);
            return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Obtener imagen para procesar
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        
        // Usar ZXing para leer códigos
        try {
            const result = ZXing.BrowserMultiFormatReader.prototype.decodeBitmapFromImageData(imageData, canvas.width, canvas.height);
            if (result && result.text) {
                const sku = result.text.trim();
                if (sku.length > 0) {
                    detenerCamara();
                    skuInput.value = sku;
                    verificarSku(sku);
                    return;
                }
            }
        } catch(e) {
            // No se detectó código, continuar
        }
        
        if (scanningActive) {
            requestAnimationFrame(capturarFrame);
        }
    }
    
    requestAnimationFrame(capturarFrame);
}

// Detener cámara
function detenerCamara() {
    scanningActive = false;
    
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    
    if (video.srcObject) {
        video.srcObject = null;
    }
    
    cameraContainer.style.display = 'none';
    video.srcObject = null;
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
    
    if (isNaN(alto) || isNaN(ancho) || isNaN(largo) || alto <= 0 || ancho <= 0 || largo <= 0) {
        showStatus('Ingresa medidas válidas (mayores a 0)', 'error');
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
