var txtSelfId = document.querySelector("input#txtSelfId");
var txtTargetId = document.querySelector("input#txtTargetId");
var btnRegister = document.querySelector("button#btnRegister");
var btnCall = document.querySelector("button#btnCall");
var localVideo = document.querySelector("video#localVideo");
var remoteVideo = document.querySelector("video#remoteVideo");
var lblFrom = document.querySelector("label#lblFrom");
var videoSelect = document.querySelector("select#videoSelect")

let peer = null;
let localConn = null;
let localStream = null;
let remoteStream = null;

let mediaRecorder;
let recordedBlobs;
let sourceBuffer;

const recordButton = document.querySelector('button#record');
const playButton = document.querySelector('button#play');

recordButton.addEventListener('click', () => {
  if (recordButton.textContent === 'Start Recording') {
    startRecording();
  } else {
    stopRecording();
    recordButton.textContent = 'Start Recording';
    playButton.disabled = false;
    downloadButton.disabled = false;
  }
});

function handleDataAvailable(event) {
  console.log('handleDataAvailable', event);
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}


function startRecording() {
  recordedBlobs = [];
  let options = {mimeType: 'video/webm;codecs=vp9'};
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    console.error(`${options.mimeType} is not Supported`);
    errorMsgElement.innerHTML = `${options.mimeType} is not Supported`;
    options = {mimeType: 'video/webm;codecs=vp8'};
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.error(`${options.mimeType} is not Supported`);
      errorMsgElement.innerHTML = `${options.mimeType} is not Supported`;
      options = {mimeType: 'video/webm'};
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not Supported`);
        errorMsgElement.innerHTML = `${options.mimeType} is not Supported`;
        options = {mimeType: ''};
      }
    }
  }

  try {
    //mediaRecorder = new MediaRecorder(window.stream, options);
	  mediaRecorder = new MediaRecorder(remoteStream, options);
	  
	  
	  
  } catch (e) {
    console.error('Exception while creating MediaRecorder:', e);
    errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(e)}`;
    return;
  }

  console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
  recordButton.textContent = 'Stop Recording';
  //playButton.disabled = true;
  //downloadButton.disabled = true;
  mediaRecorder.onstop = (event) => {
    console.log('Recorder stopped: ', event);
    console.log('Recorded Blobs: ', recordedBlobs);
  };
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(10); // collect 10ms of data
  console.log('MediaRecorder started', mediaRecorder);
}

function stopRecording() {
  mediaRecorder.stop();
}

hashCode = function (str) {
    var hash = 0;
    if (str.length == 0) return hash;
    for (i = 0; i < str.length; i++) {
        char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash;
}

function gotStream(stream) {
    console.log('received local stream');
    localStream = stream;
    localVideo.srcObject = localStream;
}

function sendMessage(from, to, action) {
    var message = { "from": from, "to": to, "action": action };
    if (!localConn) {
        localConn = peer.connect(hashCode(to));
        localConn.on('open', () => {
            localConn.send(JSON.stringify(message));
            console.log(message);
        });
    }
    if (localConn.open){
        localConn.send(JSON.stringify(message));
        console.log(message);
    }
}

function handleError(error) {
    console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}

//绑定摄像头列表到下拉框
function gotDevices(deviceInfos) {
    if (deviceInfos===undefined){
        return
    }
    for (let i = 0; i !== deviceInfos.length; ++i) {
        const deviceInfo = deviceInfos[i];
        const option = document.createElement('option');
        option.value = deviceInfo.deviceId;
        if (deviceInfo.kind === 'videoinput') {
            option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
            videoSelect.appendChild(option);
        }
    }
}

//开启本地摄像头
function start() {
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
    }

    const videoSource = videoSelect.value;
    const constraints = {
        audio: true,
        video: { width: 320, deviceId: videoSource ? { exact: videoSource } : undefined }
    };

    navigator.mediaDevices
        .getUserMedia(constraints)
        .then(gotStream)
        .then(gotDevices)
        .catch(handleError);
}

window.onload = function () {
    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {
        console.log('webrtc is not supported!');
        alert("webrtc is not supported!");
        return;
    }

    //获取摄像头列表
    navigator.mediaDevices.enumerateDevices()
        .then(gotDevices)
        .catch(handleError);

    $("#dialog-confirm").hide();

    //连接到peerjs服务器的选项
    //let connOption = { host: 'localhost', port: 9000, path: '/', debug: 3 };
	let connOption = {  debug: 3 };

//register处理
btnRegister.onclick = function () {
    if (!peer) {
        if (txtSelfId.value.length == 0) {
            alert("please input your name");
            txtSelfId.focus();
            return;
        }
        peer = new Peer(hashCode(txtSelfId.value), connOption);
        peer.on('open', function (id) {
            console.log("register success. " + id);
        });
        peer.on('call', function (call) {
            call.answer(localStream);
		console.log(localStream);
        });
        peer.on('connection', (conn) => {
            conn.on('data', (data) => {
                var msg = JSON.parse(data);
                console.log(msg);
                //收到视频邀请时，弹出询问对话框
                if (msg.action === "call") {
                    lblFrom.innerText = msg.from;
                    txtTargetId.value = msg.from;
                    $("#dialog-confirm").dialog({
                        resizable: false,
                        height: "auto",
                        width: 400,
                        modal: true,
                        buttons: {
                            "Accept": function () {
                                $(this).dialog("close");
                                sendMessage(msg.to, msg.from, "accept");
                            },
                            Cancel: function () {
                                $(this).dialog("close");
                            }
                        }
                    });
                }
                
                //接受视频通话邀请
                if (msg.action === "accept") {
                    console.log("accept call => " + JSON.stringify(msg));
                    var call = peer.call(hashCode(msg.from), localStream);
                    call.on('stream', function (stream) {
                        console.log('received remote stream');
			remoteVideo.srcObject = stream; 
			    remoteStream = stream; // stream data
                        sendMessage(msg.to, msg.from, "accept-ok");
                    });
                }

                //接受视频通话邀请后，通知另一端    
                if (msg.action === "accept-ok") {
                    console.log("accept-ok call => " + JSON.stringify(msg));
                    var call = peer.call(hashCode(msg.from), localStream);
                    call.on('stream', function (stream) {
                        console.log('received remote 手機 stream');
                        remoteVideo.srcObject = stream;
                    });
                }
            });
        });
    }
}

    btnCall.onclick = function () {
        if (txtTargetId.value.length == 0) {
            alert("please input target name");
            txtTargetId.focus();
            return;
        }
        sendMessage(txtSelfId.value, txtTargetId.value, "call");
    }

    videoSelect.onchange = start;

    start();
}

