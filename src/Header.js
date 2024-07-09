import React, { useState, useEffect } from 'react';
import { Menu, Search, Dimmer, Loader } from 'semantic-ui-react';
import { Link, useNavigate } from "react-router-dom";
import firebase from './utils/firebase';

function Header() {
    const [user, setUser] = useState(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setIsLoggingOut(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await firebase.auth().signOut();
            navigate("/");
            // onAuthStateChanged 會處理 setIsLoggingOut(false)
        } catch (error) {
            console.error("Logout error:", error);
            setIsLoggingOut(false);
        }
    };

    const viewButtonStyle = {
        backgroundColor: '#f0f8ff',
        color: '#000',
    };

    const editButtonStyle = {
        backgroundColor: '#ffebcd',
        color: '#000',
    };

    return (
        <>
            <Menu>
                <Menu.Item as={Link} to="/">KindFood ERP System</Menu.Item>
                <Menu.Item>
                    <Search />
                </Menu.Item>
                <Menu.Menu position='right'>
                    {user ? (
                        <>
                            <Menu.Item as={Link} to="/new-bomtable" style={editButtonStyle}>
                                建立 BOM 表
                            </Menu.Item>
                            <Menu.Item as={Link} to="/new-shared-material" style={editButtonStyle}>
                                建立共用料
                            </Menu.Item>
                            <Menu.Item as={Link} to="/shared-material" style={viewButtonStyle}>
                                查看共用料
                            </Menu.Item>
                            <Menu.Item as={Link} to="/bom-table" style={viewButtonStyle}>
                                查看成本列表
                            </Menu.Item>
                            <Menu.Item onClick={handleLogout}>
                                登出
                            </Menu.Item>
                        </>
                    ) : (
                        <>
                        <Menu.Item as={Link} to="/bom-table" style={viewButtonStyle}>
                            查看成本列表
                        </Menu.Item>
                        <Menu.Item as={Link} to="/signin">
                            登入
                        </Menu.Item>
                        </>
                    )}
                </Menu.Menu>
            </Menu>

            {/* 全頁面 Loading */}
            <Dimmer active={isLoggingOut} page>
                <Loader size='large'>登出中...</Loader>
            </Dimmer>
        </>
    );
}

export default Header;
