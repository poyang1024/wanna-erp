import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA1enj2ANF8HQ9tJPrk3KYbemFkI7Hh6ks",
  authDomain: "wanna-erp-system.firebaseapp.com",
  projectId: "wanna-erp-system",
  storageBucket: "wanna-erp-system.firebasestorage.app",
  messagingSenderId: "207021112139",
  appId: "1:207021112139:web:4a255e1f18aacaf75b46ce"
};

firebase.initializeApp(firebaseConfig);

export default firebase;
