import React, { useState } from 'react';
import { List, Icon } from 'semantic-ui-react';

function Categorys({ categories, selectedCategory, onSelectCategory }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpand = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <List selection>
      <List.Item
        active={selectedCategory === null}
        onClick={() => onSelectCategory(null)}
      >
        <List.Content>
          <List.Header>
            所有 Bom 表
            <Icon 
              name={isExpanded ? 'angle down' : 'angle right'} 
              onClick={toggleExpand}
              style={{ float: 'right', cursor: 'pointer' }}
            />
          </List.Header>
        </List.Content>
      </List.Item>
      <List.Item style={{ backgroundColor: 'white', cursor: 'default', fontSize: '0.73em', color: 'red', paddingLeft: '1em' }}>
        注意：
        <br />如未看到新增或修改後的類別
        <br />請重新整理頁面！
      </List.Item>
      {isExpanded && (
        <List.Item style={{ backgroundColor: 'white', cursor: 'default' }}>
          <List.List>
            {categories.map((category) => (
              <List.Item
                key={category.id}
                active={selectedCategory === category.name}
                onClick={() => onSelectCategory(category.name)}
                style={{ paddingLeft: '1em' }}
              >
                <List.Content>
                  <List.Header as='a'>{category.name}</List.Header>
                </List.Content>
              </List.Item>
            ))}
          </List.List>
        </List.Item>
      )}
    </List>
  );
}

export default Categorys;