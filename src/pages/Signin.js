import React, { useState } from 'react';
import { Form, Container, Button, Modal, Message } from 'semantic-ui-react';
import { useNavigate } from 'react-router-dom';
import firebase from '../utils/firebase';
import 'firebase/compat/auth';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function Signin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState('');

    async function onSubmit(e) {
        e.preventDefault();
        setIsLoading(true);
        try {
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            await firebase.auth().signInWithEmailAndPassword(email, password);
            
            localStorage.setItem('lastActivityTime', Date.now().toString());
            
            toast.success('登入成功！', {
                position: "top-center",
                autoClose: 1000,
            });
            
            setTimeout(() => {
                navigate('/');
            }, 1500);
        } catch (error) {
            console.log(error.code);
            switch (error.code) {
                case 'auth/invalid-email':
                    toast.error('信箱格式錯誤');
                    break;
                case 'auth/user-not-found':
                    toast.error('此信箱尚未註冊');
                    break;
                case 'auth/wrong-password':
                    toast.error('密碼錯誤');
                    break;
                case 'auth/invalid-credential':
                    toast.error('信箱或密碼錯誤');
                    break;
                default:
                    toast.error('登入失敗，請稍後再試');
            }
        } finally {
            setIsLoading(false);
        }
    }

    async function handlePasswordReset(e) {
        e.preventDefault();
        setResetLoading(true);
        setResetError('');

        try {
            await firebase.auth().sendPasswordResetEmail(resetEmail);
            toast.success('密碼重置連結已發送至您的信箱', {
                position: "top-center",
                autoClose: 3000,
            });
            setShowResetModal(false);
            setResetEmail('');
        } catch (error) {
            console.error('Password reset error:', error);
            switch (error.code) {
                case 'auth/invalid-email':
                    setResetError('信箱格式錯誤');
                    break;
                case 'auth/user-not-found':
                    setResetError('此信箱尚未註冊');
                    break;
                default:
                    setResetError('發送重置連結時發生錯誤，請稍後再試');
            }
        } finally {
            setResetLoading(false);
        }
    }

    return (
        <Container>
            <ToastContainer 
                position="top-center"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
            <Form onSubmit={onSubmit}>
                <Form.Input
                    label="信箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="請輸入信箱">
                </Form.Input>
                <Form.Input
                    label="密碼"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="請輸入密碼"
                    type="password">
                </Form.Input>
                <Button primary loading={isLoading} type="submit">
                    登入
                </Button>
                <Button 
                    type="button" 
                    onClick={() => setShowResetModal(true)}
                    style={{ marginLeft: '10px' }}
                >
                    忘記密碼？
                </Button>
            </Form>

            <Modal
                open={showResetModal}
                onClose={() => {
                    setShowResetModal(false);
                    setResetError('');
                    setResetEmail('');
                }}
                size="tiny"
            >
                <Modal.Header>重置密碼</Modal.Header>
                <Modal.Content>
                    <Form onSubmit={handlePasswordReset}>
                        {resetError && (
                            <Message negative>
                                <Message.Header>錯誤</Message.Header>
                                <p>{resetError}</p>
                            </Message>
                        )}
                        <Form.Input
                            fluid
                            label="電子信箱"
                            placeholder="請輸入您的註冊信箱"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            required
                        />
                    </Form>
                </Modal.Content>
                <Modal.Actions>
                    <Button 
                        negative 
                        onClick={() => {
                            setShowResetModal(false);
                            setResetError('');
                            setResetEmail('');
                        }}
                    >
                        取消
                    </Button>
                    <Button 
                        positive 
                        onClick={handlePasswordReset}
                        loading={resetLoading}
                    >
                        發送重置連結
                    </Button>
                </Modal.Actions>
            </Modal>
        </Container>
    );
}

export default Signin;