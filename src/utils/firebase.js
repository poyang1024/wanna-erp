import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAjDntWW060i__-VRwMkaWUsHuvTHrke64",
  authDomain: "kindfood-erp.firebaseapp.com",
  projectId: "kindfood-erp",
  storageBucket: "kindfood-erp.appspot.com",
  messagingSenderId: "867024882608",
  appId: "1:867024882608:web:d794ed87a419a8556fa475"
};


firebase.initializeApp(firebaseConfig);

export default firebase;