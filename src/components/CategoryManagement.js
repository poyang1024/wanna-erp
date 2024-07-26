import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Modal, Form, Message, Confirm } from 'semantic-ui-react';
import toast, { Toaster } from 'react-hot-toast';
import firebase from '../utils/firebase';

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ id: '', name: '' });
  const [editCategory, setEditCategory] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const showToast = (type, message) => {
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    }
  };

  const fetchCategories = useCallback(async () => {
    try {
      const snapshot = await firebase.firestore().collection('categorys').get();
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setCategories(categoriesData);
    } catch (error) {
      console.error("Error fetching categories:", error);
      setError('獲取類別時出錯');
      showToast('error', '獲取類別時出錯');
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const checkCategoryExists = useCallback((id, name, originalId = null) => {
    return categories.some(category => 
      (category.id === id && category.id !== originalId) || 
      (category.name === name && category.id !== originalId)
    );
  }, [categories]);

  const handleAddCategory = async (e) => {
    e.preventDefault();

    if (!newCategory.id.trim() || !newCategory.name.trim()) {
      showToast('error', '請填寫類別 ID 和名稱');
      return;
    }

    const existingCategory = checkCategoryExists(newCategory.id, newCategory.name);
    if (existingCategory) {
      showToast('error', '此類別 ID 或名稱已存在');
      return;
    }

    try {
      await firebase.firestore().collection('categorys').doc(newCategory.id).set({
        name: newCategory.name
      });
      setNewCategory({ id: '', name: '' });
      showToast('success', '新增類別成功');
      await fetchCategories(); // 重新獲取類別數據
    } catch (error) {
      console.error("Error adding category:", error);
      showToast('error', '添加類別時出錯');
    }
  };

  const handleEditCategory = async () => {
    if (!editCategory.id.trim() || !editCategory.name.trim()) {
      showToast('error', '請填寫類別 ID 和名稱');
      return;
    }

    const existingCategory = checkCategoryExists(editCategory.id, editCategory.name, editCategory.originalId);
    if (existingCategory) {
      showToast('error', '此類別 ID 或名稱已存在於其他類別');
      return;
    }

    try {
      if (editCategory.id !== editCategory.originalId) {
        await firebase.firestore().collection('categorys').doc(editCategory.originalId).delete();
        await firebase.firestore().collection('categorys').doc(editCategory.id).set({
          name: editCategory.name
        });
      } else {
        await firebase.firestore().collection('categorys').doc(editCategory.id).update({
          name: editCategory.name
        });
      }
      setIsModalOpen(false);
      showToast('success', '修改類別成功');
      await fetchCategories(); // 重新獲取類別數據
    } catch (error) {
      console.error("Error editing category:", error);
      showToast('error', '編輯類別時出錯');
    }
  };

  const handleDeleteCategory = async () => {
    if (categoryToDelete) {
      try {
        await firebase.firestore().collection('categorys').doc(categoryToDelete).delete();
        showToast('success', '刪除類別成功');
        await fetchCategories(); // 重新獲取類別數據
      } catch (error) {
        console.error("Error deleting category:", error);
        showToast('error', '刪除類別時出錯');
      }
    }
    setCategoryToDelete(null);
    setConfirmOpen(false);
  };

  return (
    <div>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
      <h2>類別管理</h2>
      {error && <Message negative>{error}</Message>}
      <Form onSubmit={handleAddCategory}>
        <Form.Group>
          <Form.Input
            placeholder="類別 ID"
            value={newCategory.id}
            onChange={(e) => setNewCategory({ ...newCategory, id: e.target.value })}
            required
          />
          <Form.Input
            placeholder="類別名稱"
            value={newCategory.name}
            onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
            required
          />
          <Form.Button primary type="submit">添加類別</Form.Button>
        </Form.Group>
      </Form>
      <Table celled>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>ID</Table.HeaderCell>
            <Table.HeaderCell>名稱</Table.HeaderCell>
            <Table.HeaderCell>操作</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {categories.map((category) => (
            <Table.Row key={category.id}>
              <Table.Cell>{category.id}</Table.Cell>
              <Table.Cell>{category.name}</Table.Cell>
              <Table.Cell>
                <Button onClick={() => {
                  setEditCategory({ ...category, originalId: category.id, originalName: category.name });
                  setIsModalOpen(true);
                }}>
                  編輯
                </Button>
                <Button negative onClick={() => {
                  setCategoryToDelete(category.id);
                  setConfirmOpen(true);
                }}>
                  刪除
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <Modal.Header>編輯類別</Modal.Header>
        <Modal.Content>
          <Form>
            <Form.Input
              label="ID"
              value={editCategory?.id || ''}
              onChange={(e) => setEditCategory({ ...editCategory, id: e.target.value })}
            />
            <Form.Input
              label="名稱"
              value={editCategory?.name || ''}
              onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
            />
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button negative onClick={() => setIsModalOpen(false)}>取消</Button>
          <Button positive onClick={handleEditCategory}>保存</Button>
        </Modal.Actions>
      </Modal>

      <Confirm
        open={confirmOpen}
        content='確定要刪除此類別嗎？'
        onCancel={() => {
          setConfirmOpen(false);
          setCategoryToDelete(null);
        }}
        onConfirm={handleDeleteCategory}
        cancelButton='取消'
        confirmButton='確定刪除'
      />
    </div>
  );
};

export default CategoryManagement;