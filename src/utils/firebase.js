import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDIpR7w0X_lQBnqNzh4yGnIJLAURV2UY4E",
  authDomain: "wanna-erp.firebaseapp.com",
  projectId: "wanna-erp",
  storageBucket: "wanna-erp.firebasestorage.app",
  messagingSenderId: "51973078027",
  appId: "1:51973078027:web:18f50196010c28d3dadb0e",
  measurementId: "G-871ER9H187"
};

firebase.initializeApp(firebaseConfig);

export default firebase;
