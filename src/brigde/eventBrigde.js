const ACTIONS = {
    // Student management actions
    SAVE_STUDENT: 'saveStudent',
    GET_STUDENT_LIST: 'studentList',
    DELETE_STUDENT: 'deleteStudent',
    UPDATE_STUDENT: 'updateStudent',
    OPEN_CALL : 'openCall',
    OPEN_CHAT: 'openChat',
    
    
    // Media related actions
    CAPTURE_PHOTO: 'capturePhoto',
    CAPTURE_VIDEO: 'captureVideo',
    CAPTURE_AUDIO: 'captureAudio',
    SELECT_VIDEO: 'mediaCaptured',
    SELECT_AUDIO: 'selectAudio',
    OPEN_VIDEO: 'openVideo',
    GET_VIDEO: 'getVideo',

    SELECT_MULTIPLE_PHOTOS: 'selectMultiplePhotos',
    OPEN_POPUP: 'openPopup',
    
    // UI related actions
    OPEN_POPUP: 'openPopup',
    FORM_RESET: 'formReset',
    SHOW_TOAST: 'showToast',
    
    // Data responses from native
    STUDENT_LIST: 'studentList',
    MEDIA_CAPTURED: 'mediaCaptured',

    
    // System actions
    INIT: 'init',
    ERROR: 'error'
};
class EventBridge {
  /**
   * Constructor
   * @param {Object} webViewRef - React ref to the WebView component
   */
  constructor(webViewRef = null) {
    this.webViewRef = webViewRef;
  }

  /**
   * Set or update the WebView reference
   * @param {Object} ref - React ref to the WebView component
   */
  setWebViewRef(ref) {
    this.webViewRef = ref;
  }

  /**
   * Send data to WebView with standardized format
   * @param {string} action - The action type to send
   * @param {any} data - The data payload
   * @returns {boolean} - Success status
   */
  sendToWebView(action, data) {
    if (!this.webViewRef || !this.webViewRef.current) {
      console.error('WebView reference not set or invalid');
      return false;
    }

    try {
      // Create JSON response
      const jsonResponse = JSON.stringify({ 
        type: action, 
        data: data 
      });
      
      // Create JS to execute in WebView
      const jsCode = `
        (function() {
          try {
            window.receiveDriverData && window.receiveDriverData(${JSON.stringify(jsonResponse)});
            console.log("[WebView] Received data:", ${JSON.stringify(action)});
            true;
          } catch(e) {
            console.error("[WebView] Error processing data:", e);
            false;
          }
        })();
      `;
      
      // Inject JS into WebView
      this.webViewRef.current.injectJavaScript(jsCode);
      
      console.log(`Sent to WebView: ${action}`);
      return true;
    } catch (error) {
      console.error('Failed to send data to WebView:', error);
      ToastAndroid.show('Error sending data to WebView', ToastAndroid.SHORT);
      return false;
    }
  }
}
export default EventBridge;
window.ACTIONS = ACTIONS;