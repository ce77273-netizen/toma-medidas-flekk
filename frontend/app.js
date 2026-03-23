const API_URL = window.location.origin + '/api';
let currentSku = null;
let selectedPack = null;
let codeReader = null;
let videoStream = null;

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

// Abrir cámara para escanear
scanCameraBtn.onclick = async () => {
    await iniciarCamara();
};

// Cerrar cámara
closeCameraBtn.onclick = () => {
    detenerCamara();
};

// Iniciar cámara y escáner
async function iniciarCamara() {
    try {
        cameraContainer.style.display = 'block';
        
        // Inicializar lector de códigos
        codeReader = new ZXing.BrowserMultiFormatReader();
        
        // Obtener lista de cámaras
        const videoInputDevices = await codeReader.listVideoInputDevices();
        
        if (videoInputDevices.length === 0) {
            showStatus('No se encontró cámara', 'error');
            detenerCamara();
            return;
        }
        
        // Usar la cámara trasera si está disponible
        const backCamera = videoInputDevices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('environment')
        );
        
        const selectedDeviceId = backCamera ? backCamera.deviceId : videoInputDevices[0].deviceId;
        
        // Decodificar continuamente
        await codeReader.decodeFromVideoDevice(selectedDeviceId, video, (result, err) => {
            if (result) {
                const sku = result.text.trim();
                detenerCamara();
                skuInput.value = sku;
                verificarSku(sku);
            }
        });
        
    } catch (error) {
        console.error('Error al iniciar cámara:', error);
        showStatus('Error al acceder a la cámara. Verifica los permisos.', 'error');
        detenerCamara();
    }
}

// Detener cámara
function detenerCamara() {
    if (codeReader) {
        codeReader.reset();
        codeReader = null;
    }
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
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
    // Scroll al formulario
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
