import React, { useState, useEffect } from 'react';
import { Menu, Search, Dimmer, Loader } from 'semantic-ui-react';
import { Link, useNavigate } from "react-router-dom";
import firebase from './utils/firebase';

function Header() {
    const [user, setUser] = useState(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isUpdatingUser, setIsUpdatingUser] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
            if (currentUser) {
                // 當檢測到用戶登入時，設置一個延遲
                setTimeout(() => {
                    setUser(currentUser);
                    setIsUpdatingUser(false);
                }, 2000); // 2秒延遲，可以根據實際需求調整
            } else {
                setUser(null);
                setIsUpdatingUser(false);
                if (isLoggingOut) {
                    setIsLoggingOut(false);
                    navigate("/");
                }
            }
        });

        return () => unsubscribe();
    }, [navigate, isLoggingOut]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await firebase.auth().signOut();
        } catch (error) {
            console.error("Logout error:", error);
            setIsLoggingOut(false);
        }
    };

    const styles = {
        viewButton: {
            backgroundColor: '#f0f8ff',
            color: '#000',
        },
        editButton: {
            backgroundColor: '#ffebcd',
            color: '#000',
        },
        viewButtonHover: {
            backgroundColor: '#d0e8ff',
        },
        editButtonHover: {
            backgroundColor: '#ffd7b0',
        },
        analyzeButton: {
            backgroundColor: '#baedff',
            color: '#000',
        },
        analyzeButtonHover: {
            backgroundColor: '#73cfff',
        }
    };

    const handleMouseEnter = (e, hoverStyle) => {
        Object.assign(e.target.style, hoverStyle);
    };

    const handleMouseLeave = (e, originalStyle) => {
        Object.assign(e.target.style, originalStyle);
    };

    if (isUpdatingUser) {
        return <Dimmer active><Loader>加載中...</Loader></Dimmer>;
    }

    return (
        <>
            <Menu>
                <Menu.Item as={Link} to="/">KIND FOOD ERP-System</Menu.Item>
                <Menu.Item>
                    <Search />
                </Menu.Item>
                <Menu.Menu position='right'>
                    {user ? (
                        <>
                            <Menu.Item 
                                as={Link} 
                                to="/new-bomtable" 
                                style={styles.editButton} 
                                onMouseEnter={(e) => handleMouseEnter(e, styles.editButtonHover)}
                                onMouseLeave={(e) => handleMouseLeave(e, styles.editButton)}
                            >
                                建立 BOM 表
                            </Menu.Item>
                            <Menu.Item 
                                as={Link} 
                                to="/new-shared-material" 
                                style={styles.editButton} 
                                onMouseEnter={(e) => handleMouseEnter(e, styles.editButtonHover)}
                                onMouseLeave={(e) => handleMouseLeave(e, styles.editButton)}
                            >
                                建立共用料
                            </Menu.Item>
                            <Menu.Item 
                                as={Link} 
                                to="/bom-table" 
                                style={styles.viewButton} 
                                onMouseEnter={(e) => handleMouseEnter(e, styles.viewButtonHover)}
                                onMouseLeave={(e) => handleMouseLeave(e, styles.viewButton)}
                            >
                                查看 BOM 表
                            </Menu.Item>
                            <Menu.Item 
                                as={Link} 
                                to="/shared-material" 
                                style={styles.viewButton} 
                                onMouseEnter={(e) => handleMouseEnter(e, styles.viewButtonHover)}
                                onMouseLeave={(e) => handleMouseLeave(e, styles.viewButton)}
                            >
                                查看共用料
                            </Menu.Item>
                            <Menu.Item 
                                as={Link} 
                                to="/excel-analysis" 
                                style={styles.analyzeButton} 
                                onMouseEnter={(e) => handleMouseEnter(e, styles.analyzeButtonHover)}
                                onMouseLeave={(e) => handleMouseLeave(e, styles.analyzeButton)}
                            >
                                Excel 分析
                            </Menu.Item>
                            <Menu.Item onClick={handleLogout}>
                                登出
                            </Menu.Item>
                        </>
                    ) : (
                        <Menu.Item as={Link} to="/signin">
                            登入
                        </Menu.Item>
                    )}
                </Menu.Menu>
            </Menu>

            <Dimmer active={isLoggingOut} page>
                <Loader size='large'>登出中，請稍候...</Loader>
            </Dimmer>
        </>
    );
}

export default Header;