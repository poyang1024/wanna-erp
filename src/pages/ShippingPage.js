import React, { useState, useEffect, useMemo } from 'react';
import { Container, Header, Button, Message, Table, Tab, Form, Icon, Loader, Dimmer, Segment, Divider, Card, Statistic, Grid, Accordion, Modal, Pagination } from "semantic-ui-react";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as XLSX from 'xlsx';
import firebase from "../utils/firebase";

function ShippingPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bomTables, setBomTables] = useState([]);
  const [customCombinations, setCustomCombinations] = useState([]);
  const [file, setFile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [calculatedOrders, setCalculatedOrders] = useState([]);
  const [groupedOrders, setGroupedOrders] = useState([]);
  const [verifiedOrders, setVerifiedOrders] = useState({});
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState({ 
    s60Count: 0, 
    s90Count: 0, 
    unmatchedSkus: [],
    bomMatchCount: 0,
    customMatchCount: 0
  });
  const [activeTab, setActiveTab] = useState(0);
  const [activeAccordions, setActiveAccordions] = useState({});
  const [activeCustomComponents, setActiveCustomComponents] = useState({});
  const [activeCustomStats, setActiveCustomStats] = useState({});
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [skuStats, setSkuStats] = useState([]);
  // 分頁功能相關狀態
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // 打開 SKU 統計模態視窗
  const openSkuStatsModal = () => {
    // 在開啟模態視窗時重新計算 SKU 統計數據
    setSkuStats(calculateTotalSkuCounts());
    setIsStatsModalOpen(true);
  };
  // 檢查用戶登入狀態
  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchBomTables();
        fetchCustomCombinations();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 獲取所有 BOM 表格來進行 SKU 比對
  const fetchBomTables = async () => {
    try {
      setLoading(true);
      const snapshot = await firebase.firestore().collection("bom_tables").get();
      
      const bomTablesData = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data();
        
        // 計算 BOM 表的總成本
        let cost = 0;
        if (data.items && data.items.length > 0) {
          // 處理 items 並計算成本
          const items = await Promise.all(data.items.map(async item => {
            let unitCost = 0;
            
            if (item.isShared) {
              // 處理共用料
              if (item.unitCost instanceof firebase.firestore.DocumentReference) {
                const unitCostDoc = await item.unitCost.get();
                unitCost = unitCostDoc.exists ? parseFloat(unitCostDoc.data().unitCost) || 0 : 0;
              } else {
                unitCost = parseFloat(item.unitCost) || 0;
              }
            } else {
              // 非共用料直接使用單位成本
              unitCost = parseFloat(item.unitCost) || 0;
            }
            
            const quantity = parseFloat(item.quantity) || 0;
            const isTaxed = item.isTaxed || false;
            
            // 計算此項目的成本（含稅）
            const itemCost = quantity * unitCost;
            const tax = isTaxed ? itemCost * 0.05 : 0;
            
            cost += itemCost + tax;
            
            return {
              ...item,
              calculatedCost: itemCost + tax
            };
          }));
        }
        
        // 針對每個 BOM 表格，收集料號、體積和成本信息
        return {
          id: doc.id,
          productCode: data.productCode || '',
          volume: data.volume || 0,
          tableName: data.tableName || '',
          cost: cost, // 添加成本信息
          source: 'bom' // 標記來源為 BOM 表
        };
      }));
      
      setBomTables(bomTablesData);
    } catch (error) {
      console.error("Error fetching BOM tables:", error);
      toast.error("獲取 BOM 表格失敗");
      setLoading(false);
    }
  };

  // 獲取自訂義組合來進行 SKU 比對
  const fetchCustomCombinations = async () => {
    try {
      const snapshot = await firebase.firestore().collection("custom_combinations").get();
      
      // 處理每個自訂義組合，計算其總體積和成本
      const customCombinationsData = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data();
        let totalVolume = 0;
        let totalCost = 0; // 添加總成本計算
        const combinationComponents = []; // 儲存組合中的所有 BOM 表資料
        
        // 如果有產品，計算總體積和總成本
        if (data.products && data.products.length > 0) {
          for (const product of data.products) {
            // 查找相應 BOM 表格獲取體積和成本
            const bomRef = product.productId ? 
              await firebase.firestore().collection('bom_tables').doc(product.productId).get() : null;
            
            if (bomRef && bomRef.exists) {
              const bomData = bomRef.data();
              const productVolume = bomData.volume || 0;
              const bomQuantity = product.quantity || 1;
              
              // 計算BOM表的總成本
                let productCost = 0;
                if (bomData.items && bomData.items.length > 0) {
                // 遍歷所有項目計算成本
                for (const item of bomData.items) {
                    let itemUnitCost = 0;
                    if (item.isShared) {
                    // 處理共用料
                    if (item.unitCost instanceof firebase.firestore.DocumentReference) {
                        const unitCostDoc = await item.unitCost.get();
                        itemUnitCost = unitCostDoc.exists ? parseFloat(unitCostDoc.data().unitCost) || 0 : 0;
                    } else {
                        itemUnitCost = parseFloat(item.unitCost) || 0;
                    }
                    } else {
                    itemUnitCost = parseFloat(item.unitCost) || 0;
                    }
                    
                    const itemQuantity = parseFloat(item.quantity) || 0;
                    const isTaxed = item.isTaxed || false;
                    
                    // 計算此項目的成本（含稅）
                    const itemCost = itemQuantity * itemUnitCost;
                    const tax = isTaxed ? itemCost * 0.05 : 0;
                    
                    productCost += itemCost + tax;
                }
                }

                totalVolume += productVolume * bomQuantity;
                totalCost += productCost * bomQuantity; // 計算總成本
              
              // 將 BOM 表資料添加到組合元件列表中
              combinationComponents.push({
                id: product.productId,
                name: bomData.tableName || '未命名產品',
                productCode: bomData.productCode || '無料號',
                quantity: bomQuantity,
                unitVolume: productVolume,
                totalVolume: productVolume * bomQuantity,
                unitCost: productCost, // 添加單位成本
                totalCost: productCost * bomQuantity // 添加總成本
              });
            }
          }
        }
        
        return {
          id: doc.id,
          productCode: data.productCode || '',
          name: data.name || '未命名組合',
          volume: totalVolume,
          cost: totalCost, // 添加總成本
          source: 'custom', // 標記來源為自訂義組合
          components: combinationComponents // 儲存組合中的 BOM 表資料
        };
      }));
      
      setCustomCombinations(customCombinationsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching custom combinations:", error);
      toast.error("獲取自訂義組合失敗");
      setLoading(false);
    }
  };
  // 處理文件上傳
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFile(file);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // 處理訂單數據
        setOrders(data);
        toast.success("Excel 檔案讀取成功");
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast.error("Excel 檔案解析失敗");
      }
    };
    reader.readAsBinaryString(file);
  };

  // 計算訂單所需的紙箱
  const calculateBoxTypes = () => {
    if (orders.length === 0) {
      toast.error("請先上傳訂單 Excel 檔案");
      return;
    }
    
    setProcessing(true);
    setVerifiedOrders({});  // 重設撿貨狀態
    
    let bomMatchCount = 0;
    let customMatchCount = 0;
    const skuCounter = {}; // 用於統計 SKU 數量
    
    // 處理每個訂單
    const processedOrders = orders.map(order => {
      // 取得訂單號和 SKU
      const orderNumber = order["訂單編號"] || order["order_number"] || "未知";
      const customerName = order["收件人名稱"] || order["customer_name"] || "未知";
      
      // 處理 SKU 和數量，支持 "SKU*數量" 格式
      let sku = order["SKU"] || order["sku"] || order["商品編號"] || "未知";
      let orderQuantity = parseInt(order["數量"] || order["quantity"] || 1);
      
      // 檢查 SKU 是否包含 "*" 符號（如 SS005*5）
      let starQuantity = 1;
      if (sku.includes('*')) {
        const parts = sku.split('*');
        if (parts.length === 2 && !isNaN(parts[1])) {
          sku = parts[0].trim(); // 設置真正的 SKU，去除可能的空格
          starQuantity = parseInt(parts[1]); // 使用 * 後面的數量
        }
      }
      
      // 計算最終數量 = 訂單數量 * * 後的數量
      const quantity = orderQuantity * starQuantity;
      
      // 更新 SKU 統計
      if (sku in skuCounter) {
        skuCounter[sku] += quantity;
      } else {
        skuCounter[sku] = quantity;
      }
      
      const address = order["收件人地址"] || order["address"] || "未知";
      const phone = order["收件人電話"] || order["phone"] || "未知";
      
      // 首先嘗試在 BOM 表中查找
      const matchedBom = bomTables.find(bom => bom.productCode === sku);
      
      // 如果 BOM 表中找不到，嘗試在自訂義組合中查找
      let matchedProduct = matchedBom;
      let matchSource = 'bom';
      let customComponents = null;
      let unitCost = 0; // 新增：單位成本
      let totalCost = 0; // 新增：總成本
      
      if (!matchedBom) {
        const matchedCustom = customCombinations.find(combo => combo.productCode === sku);
        if (matchedCustom) {
          matchedProduct = matchedCustom;
          matchSource = 'custom';
          customComponents = matchedCustom.components || [];
          
          // 計算自訂義組合的成本
          if (customComponents.length > 0) {
            // 獲取每個組件的成本並計算總成本
            let componentsTotalCost = 0;
            customComponents.forEach(component => {
              const componentBom = bomTables.find(bom => bom.id === component.id);
              if (componentBom && componentBom.cost) {
                componentsTotalCost += componentBom.cost * component.quantity;
              }
            });
            unitCost = componentsTotalCost;
          }
          
          customMatchCount++;
        }
      } else {
        // 從 BOM 表獲取成本
        unitCost = matchedBom.cost || 0;
        bomMatchCount++;
      }
      
      // 計算總成本
      totalCost = unitCost * quantity;
      
      let unitVolume = 0;
      let totalVolume = 0;
      let matchStatus = '未匹配';
      
      if (matchedProduct) {
        unitVolume = parseFloat(matchedProduct.volume) || 0;
        totalVolume = unitVolume * quantity;
        matchStatus = '已匹配';
      }
      
      return {
        orderNumber,
        customerName,
        address,
        phone,
        sku,
        productName: order["商品名稱"] || order["product_name"] || "未知",
        quantity,
        orderQuantity,
        starQuantity,
        unitVolume,
        totalVolume,
        unitCost, // 新增：單位成本
        totalCost, // 新增：總成本
        matchStatus,
        matchSource,
        bomName: matchedProduct ? matchedProduct.tableName || matchedProduct.name : '未找到匹配的商品',
        customComponents: customComponents
      };
    });

    setCalculatedOrders(processedOrders);
    
    // 將 SKU 統計轉換為數組並排序
    const skuStatsArray = Object.entries(skuCounter).map(([sku, count]) => {
      const matchedBom = bomTables.find(bom => bom.productCode === sku);
      const matchedCustom = customCombinations.find(combo => combo.productCode === sku);
      const matchedProduct = matchedBom || matchedCustom;
      const matchSource = matchedBom ? 'bom' : (matchedCustom ? 'custom' : 'none');
      
      return {
        sku,
        count,
        name: matchedProduct ? matchedProduct.tableName || matchedProduct.name : '未找到匹配的商品',
        matchStatus: matchedProduct ? '已匹配' : '未匹配',
        matchSource
      };
    }).sort((a, b) => b.count - a.count); // 按數量降序排序
    
    setSkuStats(skuStatsArray);
    
    // 收集未匹配的 SKU
    const unmatchedSkus = processedOrders
      .filter(order => order.matchStatus === '未匹配')
      .map(order => order.sku)
      .filter((value, index, self) => self.indexOf(value) === index); // 去重
    
    // 將訂單按照訂單編號分組
    const grouped = processedOrders.reduce((acc, order) => {
        const { orderNumber } = order;
        if (!acc[orderNumber]) {
          acc[orderNumber] = {
            orderNumber,
            customerName: order.customerName,
            address: order.address,
            phone: order.phone,
            items: [],
            totalVolume: 0,
            totalCost: 0, // 新增：訂單總成本
            boxType: null
          };
        }
        
        acc[orderNumber].items.push(order);
        acc[orderNumber].totalVolume += order.totalVolume;
        acc[orderNumber].totalCost += order.totalCost; // 新增：累加訂單項的成本
        
        // 根據總體積決定紙箱類型
        acc[orderNumber].boxType = acc[orderNumber].totalVolume <= 14 ? 'S60' : 'S90';
        
        return acc;
      }, {});
      
      // 轉換為陣列並排序
      const groupedArray = Object.values(grouped).sort((a, b) => 
        a.orderNumber.localeCompare(b.orderNumber)
      );
      
      // 正確計算紙箱數量和總成本
      const s60Count = groupedArray.filter(order => order.boxType === 'S60').length;
      const s90Count = groupedArray.filter(order => order.boxType === 'S90').length;
      const totalOrdersCost = groupedArray.reduce((sum, order) => sum + order.totalCost, 0); // 新增：計算所有訂單的總成本
      
      setGroupedOrders(groupedArray);
      setSummary({ 
        s60Count, 
        s90Count, 
        unmatchedSkus,
        bomMatchCount,
        customMatchCount,
        totalOrdersCost // 新增：總成本
      });
      
      setActiveAccordions({}); // 重置下拉面板狀態
      setProcessing(false);
      setActiveTab(1); // 切換到結果頁籤
      setCurrentPage(1); // 設置分頁回到第一頁
    };

  // 切換訂單詳情的開合狀態
  const toggleAccordion = (orderNumber) => {
    setActiveAccordions({
      ...activeAccordions,
      [orderNumber]: !activeAccordions[orderNumber]
    });
  };

  // 切換自定義組合詳情的開合狀態
  const toggleCustomComponents = (orderNumber, itemIndex) => {
    const key = `${orderNumber}-${itemIndex}`;
    setActiveCustomComponents({
      ...activeCustomComponents,
      [key]: !activeCustomComponents[key]
    });
  };

  // 處理訂單撿貨狀態切換
  const toggleVerification = (orderNumber) => {
    setVerifiedOrders(prev => ({
      ...prev,
      [orderNumber]: !prev[orderNumber]
    }));
    
    if (!verifiedOrders[orderNumber]) {
      toast.success(`訂單 ${orderNumber} 已標記為撿貨完成`);
    } else {
      toast.info(`訂單 ${orderNumber} 撿貨標記已取消`);
    }
  };

  // 獲取已撿貨和未撿貨的訂單數量
  const getVerificationSummary = () => {
    const verifiedCount = Object.values(verifiedOrders).filter(Boolean).length;
    const totalCount = groupedOrders.length;
    const unverifiedCount = totalCount - verifiedCount;
    
    return { verifiedCount, unverifiedCount, totalCount };
  };

  // 計算 SKU 總數量，包括自定義組合內的 BOM 表
  const calculateTotalSkuCounts = () => {
    const skuCounter = {};
    const bomComponentsCounter = {};
    const skuCosts = {}; // 新增：記錄每個 SKU 的成本
    const componentCosts = {}; // 新增：記錄每個組件的成本
    
    // 第一輪：計算普通 SKU 和自定義組合的數量和成本
    calculatedOrders.forEach(order => {
      const { sku, quantity, matchSource, customComponents, unitCost } = order;
      
      // 更新 SKU 計數
      if (sku in skuCounter) {
        skuCounter[sku] += quantity;
        skuCosts[sku] = unitCost; // 更新成本 (最後一個訂單的單位成本)
      } else {
        skuCounter[sku] = quantity;
        skuCosts[sku] = unitCost; // 設置成本
      }
      
      // 如果是自定義組合，還需要計算其中的 BOM 表數量
      if (matchSource === 'custom' && customComponents && customComponents.length > 0) {
        customComponents.forEach(component => {
          const componentSku = component.productCode;
          const componentQuantity = component.quantity * quantity; // 組合數量 × 組件數量
          
          if (componentSku in bomComponentsCounter) {
            bomComponentsCounter[componentSku] += componentQuantity;
          } else {
            bomComponentsCounter[componentSku] = componentQuantity;
          }
          
          // 記錄組件成本
          const matchedBom = bomTables.find(bom => bom.productCode === componentSku);
          if (matchedBom) {
            componentCosts[componentSku] = matchedBom.cost || 0;
          }
        });
      }
    });
    
    // 準備最終的統計數據
    const skuStats = Object.entries(skuCounter).map(([sku, count]) => {
      const matchedBom = bomTables.find(bom => bom.productCode === sku);
      const matchedCustom = customCombinations.find(combo => combo.productCode === sku);
      const matchedProduct = matchedBom || matchedCustom;
      const matchSource = matchedBom ? 'bom' : (matchedCustom ? 'custom' : 'none');
      
      // 查找此 SKU 是否同時作為組件出現在組合中
      const componentCount = bomComponentsCounter[sku] || 0;
      const unitCost = skuCosts[sku] || 0;
      const componentUnitCost = componentCosts[sku] || 0;
      
      // 計算總成本
      const directCost = count * unitCost;
      const componentTotalCost = componentCount * componentUnitCost;
      const totalCost = directCost + componentTotalCost;
      
      return {
        sku,
        count,
        componentCount,
        totalCount: count + componentCount,
        unitCost, // 新增：單位成本
        totalCost, // 新增：總成本
        name: matchedProduct ? matchedProduct.tableName || matchedProduct.name : '未找到匹配的商品',
        matchStatus: matchedProduct ? '已匹配' : '未匹配',
        matchSource,
        // 如果是自定義組合，還需包含組件信息
        components: matchSource === 'custom' ? matchedProduct?.components || [] : []
      };
    });
    
    // 檢查組件中是否有未作為單獨 SKU 出現的項目
    Object.entries(bomComponentsCounter).forEach(([sku, count]) => {
        if (!skuCounter[sku]) {
          const matchedBom = bomTables.find(bom => bom.productCode === sku);
          const unitCost = componentCosts[sku] || 0;
          
          if (matchedBom) {
            skuStats.push({
              sku,
              count: 0,
              componentCount: count,
              totalCount: count,
              unitCost, // 新增：單位成本
              totalCost: count * unitCost, // 新增：總成本
              name: matchedBom.tableName || '未命名產品',
              matchStatus: '已匹配',
              matchSource: 'bom',
              components: []
            });
          }
        }
      });
      
      // 按總數量排序
      return skuStats.sort((a, b) => b.totalCount - a.totalCount);
    };

  // 處理頁碼變更
  const handlePageChange = (e, { activePage }) => {
    setCurrentPage(activePage);
  };

  // 處理每頁顯示數量變更
  const handleItemsPerPageChange = (e, { value }) => {
    setItemsPerPage(value);
    setCurrentPage(1); // 切換後回到第一頁
  };

  // 計算總頁數
  const totalPages = useMemo(() => {
    return Math.ceil(groupedOrders.length / itemsPerPage);
  }, [groupedOrders.length, itemsPerPage]);

  // 根據當前頁碼和每頁顯示數量計算當前頁的訂單列表
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return groupedOrders.slice(startIndex, endIndex);
  }, [groupedOrders, currentPage, itemsPerPage]);

  // Tab 頁籤
  const panes = [
    {
      menuItem: '上傳訂單',
      render: () => (
        <Tab.Pane>
          <Segment raised padded style={{ backgroundColor: '#f9f9f9' }}>
            <Header as="h3" icon textAlign="center">
              <Icon name="file excel outline" circular />
              <Header.Content>上傳訂單 Excel 檔案</Header.Content>
              <Header.Subheader style={{ marginTop: '10px' }}>
                請上傳包含訂單和商品 SKU 資訊的 Excel 檔案
              </Header.Subheader>
            </Header>
            
            <Form>
              <Form.Field>
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleFileUpload} 
                  style={{ margin: '20px auto', display: 'block' }}
                />
              </Form.Field>
              {orders.length > 0 && (
                <div style={{ textAlign: 'center', margin: '20px 0' }}>
                  <Message positive>
                    <Icon name="check circle" />
                    已成功讀取 {orders.length} 筆記錄
                  </Message>
                  <Button 
                    style={{ backgroundColor: '#C17767', color: '#000', marginTop: '15px' }}
                    size="large" 
                    onClick={calculateBoxTypes}
                  >
                    <Icon name="calculator" />
                    開始計算紙箱需求
                  </Button>
                </div>
              )}
            </Form>
          </Segment>
        </Tab.Pane>
      ),
    },

    {
        menuItem: '紙箱分配結果',
        render: () => (
          <Tab.Pane>
            {processing ? (
              <Segment>
                <Dimmer active inverted>
                  <Loader size="large">處理訂單數據中...</Loader>
                </Dimmer>
              </Segment>
            ) : groupedOrders.length > 0 ? (
              <div>
                <Grid columns={3} stackable style={{ marginBottom: '20px' }}>
                  <Grid.Row>
                    <Grid.Column>
                      <Segment raised padded style={{ backgroundColor: '#f9f9f9' }}>
                        <Statistic.Group widths="two">
                          <Statistic color="blue">
                            <Statistic.Value>{summary.s60Count}</Statistic.Value>
                            <Statistic.Label>S60 紙箱</Statistic.Label>
                          </Statistic>
                          <Statistic color="orange">
                            <Statistic.Value>{summary.s90Count}</Statistic.Value>
                            <Statistic.Label>S90 紙箱</Statistic.Label>
                          </Statistic>
                        </Statistic.Group>
                        <Divider />
                            <Statistic size="small">
                            <Statistic.Value>
                                ${summary.totalOrdersCost ? summary.totalOrdersCost.toFixed(2) : '0.00'}
                            </Statistic.Value>
                            <Statistic.Label>訂單總成本</Statistic.Label>
                            </Statistic>
                      </Segment>
                    </Grid.Column>
                    <Grid.Column>
                      <Segment raised padded style={{ backgroundColor: '#f9f9f9' }}>
                        <Header as="h4">
                          <Icon name="info circle" />
                          <Header.Content>紙箱分配邏輯</Header.Content>
                        </Header>
                        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ width: '12px', height: '12px', backgroundColor: '#81C0C0', marginRight: '8px', borderRadius: '2px' }}></div>
                            <span>體積單位 ≤ 14：使用 S60 紙箱</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '12px', height: '12px', backgroundColor: '#C17767', marginRight: '8px', borderRadius: '2px' }}></div>
                            <span>體積單位 &gt; 14：使用 S90 紙箱</span>
                          </div>
                        </div>
                      </Segment>
                    </Grid.Column>
                    <Grid.Column>
                      <Segment raised padded style={{ backgroundColor: '#f9f9f9' }}>
                        <Header as="h4">
                          <Icon name="clipboard check" />
                          <Header.Content>撿貨進度</Header.Content>
                        </Header>
                        <div style={{ marginTop: '10px' }}>
                          <div>{getVerificationSummary().verifiedCount} / {getVerificationSummary().totalCount} 已撿貨</div>
                          <div style={{ marginTop: '10px', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                            <div style={{ 
                              height: '100%', 
                              width: `${(getVerificationSummary().verifiedCount / getVerificationSummary().totalCount) * 100}%`,
                              backgroundColor: '#21ba45',
                              borderRadius: '4px'
                            }}></div>
                          </div>
                        </div>
                      </Segment>
                    </Grid.Column>
                  </Grid.Row>
                </Grid>
                <Grid columns={2} stackable style={{ marginBottom: '20px' }}>
                <Grid.Row>
                  <Grid.Column>
                    <Segment raised padded style={{ backgroundColor: '#f9f9f9' }}>
                      <Header as="h4">
                        <Icon name="linkify" />
                        <Header.Content>商品匹配統計</Header.Content>
                      </Header>
                      <div style={{ marginTop: '10px' }}>
                        <p><Icon name="table" /> 從 BOM 表匹配: <strong>{summary.bomMatchCount}</strong> 個商品</p>
                        <p><Icon name="random" /> 從自訂義組合匹配: <strong>{summary.customMatchCount}</strong> 個商品</p>
                        <p><Icon name="warning sign" /> 未能匹配: <strong>{summary.unmatchedSkus.length}</strong> 個商品</p>
                        <Button 
                          color="blue" 
                          style={{ marginTop: '10px' }}
                          onClick={openSkuStatsModal}
                        >
                          <Icon name="chart bar" /> 查看 SKU 統計數據
                        </Button>
                      </div>
                    </Segment>
                  </Grid.Column>
                  {summary.unmatchedSkus.length > 0 && (
                    <Grid.Column>
                      <Segment raised padded style={{ backgroundColor: '#f9f9f9' }}>
                        <Header as="h4">
                          <Icon name="attention" />
                          <Header.Content>未匹配的 SKU</Header.Content>
                        </Header>
                        <div style={{ maxHeight: '100px', overflowY: 'auto', margin: '10px 0' }}>
                          {summary.unmatchedSkus.map((sku, index) => (
                            <span key={index} style={{ display: 'inline-block', margin: '0 10px 5px 0', padding: '5px 8px', background: '#fff3cd', borderRadius: '4px' }}>
                              {sku}
                            </span>
                          ))}
                        </div>
                      </Segment>
                    </Grid.Column>
                  )}
                </Grid.Row>
              </Grid>
              <Header as="h3" dividing>
                <Icon name="shipping fast" />
                <Header.Content>訂單紙箱分配明細</Header.Content>
              </Header>
              
              {/* 分頁控制區域 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1em 0' }}>
                <div>
                  <span style={{ marginRight: '1em' }}>顯示: </span>
                  <Form.Select
                    compact
                    options={[
                      { key: '5', text: '5 筆/頁', value: 5 },
                      { key: '10', text: '10 筆/頁', value: 10 },
                      { key: '20', text: '20 筆/頁', value: 20 },
                      { key: '50', text: '50 筆/頁', value: 50 },
                    ]}
                    value={itemsPerPage}
                    onChange={handleItemsPerPageChange}
                  />
                </div>
                <div>
                  <span style={{ marginRight: '1em' }}>
                    顯示 {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, groupedOrders.length)} 筆，共 {groupedOrders.length} 筆
                  </span>
                </div>
              </div>
              
              <Table celled structured style={{ marginTop: '1em' }}>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell rowSpan="2">訂單編號</Table.HeaderCell>
                        <Table.HeaderCell rowSpan="2">收件人資訊</Table.HeaderCell>
                        <Table.HeaderCell rowSpan="2">總體積</Table.HeaderCell>
                        <Table.HeaderCell rowSpan="2">總成本</Table.HeaderCell> {/* 新增列 */}
                        <Table.HeaderCell rowSpan="2">紙箱類型</Table.HeaderCell>
                        <Table.HeaderCell rowSpan="2">撿貨狀態</Table.HeaderCell>
                        <Table.HeaderCell rowSpan="2">操作</Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                  {paginatedOrders.map((order) => (
                    <React.Fragment key={order.orderNumber}>
                      <Table.Row style={{ backgroundColor: verifiedOrders[order.orderNumber] ? '#f9fff9' : 'white' }}>
                        <Table.Cell>
                          <strong>{order.orderNumber}</strong>
                        </Table.Cell>
                        <Table.Cell>
                          <div><strong>姓名:</strong> {order.customerName}</div>
                          <div style={{ marginTop: '5px' }}><strong>地址:</strong> {order.address}</div>
                          <div style={{ marginTop: '5px' }}><strong>電話:</strong> {order.phone}</div>
                        </Table.Cell>
                        <Table.Cell textAlign="center">
                          <strong>{order.totalVolume.toFixed(2)}</strong>
                        </Table.Cell>
                        {/* 訂單行中添加成本顯示 */}
                        <Table.Cell textAlign="center">
                        <strong>${order.totalCost.toFixed(2)}</strong>
                        </Table.Cell>
                        <Table.Cell textAlign="center">
                          <span style={{ 
                            display: 'inline-block', 
                            padding: '5px 10px', 
                            borderRadius: '5px', 
                            background: order.boxType === 'S60' ? '#81C0C0' : '#C17767',
                            color: '#000',
                            fontWeight: 'bold'
                          }}>
                            {order.boxType}
                          </span>
                        </Table.Cell>
                        <Table.Cell textAlign="center">
                          <Button
                            icon
                            labelPosition="right"
                            color={verifiedOrders[order.orderNumber] ? 'green' : 'grey'}
                            onClick={() => toggleVerification(order.orderNumber)}
                          >
                            {verifiedOrders[order.orderNumber] ? '已撿貨' : '未撿貨'}
                            <Icon name={verifiedOrders[order.orderNumber] ? 'check' : 'clock'} />
                          </Button>
                        </Table.Cell>
                        <Table.Cell textAlign="center">
                          <Button 
                            icon 
                            labelPosition="right"
                            onClick={() => toggleAccordion(order.orderNumber)}
                            style={{ backgroundColor: activeAccordions[order.orderNumber] ? '#f0f0f0' : '#fff' }}
                          >
                            {activeAccordions[order.orderNumber] ? '收起' : '展開'}
                            <Icon name={activeAccordions[order.orderNumber] ? 'angle up' : 'angle down'} />
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                      {activeAccordions[order.orderNumber] && (
                        <Table.Row>
                          <Table.Cell colSpan="6" style={{ padding: 0 }}>
                            <Table celled>
                            <Table.Header>
                                <Table.Row>
                                    <Table.HeaderCell>SKU</Table.HeaderCell>
                                    <Table.HeaderCell>商品名稱</Table.HeaderCell>
                                    <Table.HeaderCell>數量詳情</Table.HeaderCell>
                                    <Table.HeaderCell>單位體積</Table.HeaderCell>
                                    <Table.HeaderCell>總體積</Table.HeaderCell>
                                    <Table.HeaderCell>單位成本</Table.HeaderCell> {/* 新增列 */}
                                    <Table.HeaderCell>總成本</Table.HeaderCell> {/* 新增列 */}
                                    <Table.HeaderCell>匹配狀態</Table.HeaderCell>
                                </Table.Row>
                            </Table.Header>
                              <Table.Body>
                                {order.items.map((item, itemIndex) => (
                                  <React.Fragment key={itemIndex}>
                                    <Table.Row
                                      warning={item.matchStatus === '未匹配'}
                                      style={item.matchSource === 'custom' ? { backgroundColor: '#fff8e1' } : {}}
                                    >
                                      <Table.Cell>{item.sku}</Table.Cell>
                                      <Table.Cell>{item.productName}</Table.Cell>
                                      <Table.Cell textAlign="center">
                                        {item.quantity}
                                        {(item.orderQuantity > 1 || item.starQuantity > 1) && (
                                          <div style={{ fontSize: '0.9em', marginTop: '5px', color: '#666' }}>
                                            ({item.orderQuantity} × {item.starQuantity})
                                          </div>
                                        )}
                                      </Table.Cell>
                                      <Table.Cell textAlign="center">
                                        {item.matchStatus === '已匹配' ? `${item.unitVolume.toFixed(2)}` : '未知'}
                                      </Table.Cell>
                                      <Table.Cell textAlign="center">
                                        {item.matchStatus === '已匹配' ? `${item.totalVolume.toFixed(2)}` : '未知'}
                                      </Table.Cell>
                                      <Table.Cell textAlign="center">
                                        {item.matchStatus === '已匹配' ? `$${item.unitCost.toFixed(2)}` : '未知'}
                                        </Table.Cell>
                                        <Table.Cell textAlign="center">
                                        {item.matchStatus === '已匹配' ? `$${item.totalCost.toFixed(2)}` : '未知'}
                                    </Table.Cell>
                                      <Table.Cell>
                                        {item.matchStatus === '已匹配' ? (
                                          <span style={{ color: 'green' }}>
                                            <Icon name="check circle" /> 
                                            {item.bomName}
                                            {item.matchSource === 'custom' && (
                                              <>
                                                <small style={{ marginLeft: '5px', color: '#ff8c00' }}>
                                                  (自訂義組合)
                                                </small>
                                                {item.customComponents && item.customComponents.length > 0 && (
                                                  <Button 
                                                    size="mini" 
                                                    icon 
                                                    style={{ marginLeft: '5px', padding: '2px 5px' }}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleCustomComponents(order.orderNumber, itemIndex);
                                                    }}
                                                  >
                                                    <Icon name={activeCustomComponents[`${order.orderNumber}-${itemIndex}`] ? 'angle up' : 'angle down'} />
                                                    {activeCustomComponents[`${order.orderNumber}-${itemIndex}`] ? '收起組合' : '查看組合'}
                                                  </Button>
                                                )}
                                              </>
                                            )}
                                          </span>
                                        ) : (
                                          <span style={{ color: 'red' }}>
                                            <Icon name="times circle" /> 未找到匹配的商品
                                          </span>
                                        )}
                                      </Table.Cell>
                                    </Table.Row>
                                    {/* 自定義組合詳細內容 */}
                                    {item.matchSource === 'custom' && 
                                    activeCustomComponents[`${order.orderNumber}-${itemIndex}`] && 
                                    item.customComponents && 
                                    item.customComponents.length > 0 && (
                                      <Table.Row key={`${itemIndex}-components`}>
                                        <Table.Cell colSpan="6" style={{ backgroundColor: '#fffbf0', padding: '0.5em 2em' }}>
                                          <div style={{ margin: '10px 0' }}>
                                            <Header as="h5" style={{ color: '#ff8c00' }}>
                                              <Icon name="cubes" />
                                              <Header.Content>自定義組合「{item.bomName}」包含以下商品：</Header.Content>
                                            </Header>
                                            <Table compact size="small">
                                              <Table.Header>
                                                <Table.Row>
                                                    <Table.HeaderCell>料號</Table.HeaderCell>
                                                    <Table.HeaderCell>BOM表名稱</Table.HeaderCell>
                                                    <Table.HeaderCell>數量</Table.HeaderCell>
                                                    <Table.HeaderCell>單位體積</Table.HeaderCell>
                                                    <Table.HeaderCell>總體積</Table.HeaderCell>
                                                    <Table.HeaderCell>單位成本</Table.HeaderCell> {/* 新增列 */}
                                                    <Table.HeaderCell>總成本</Table.HeaderCell> {/* 新增列 */}
                                                </Table.Row>
                                              </Table.Header>
                                              <Table.Body>
                                                {item.customComponents.map((component, compIndex) => (
                                                  <Table.Row key={compIndex}>
                                                    <Table.Cell>{component.productCode}</Table.Cell>
                                                    <Table.Cell>{component.name}</Table.Cell>
                                                    <Table.Cell textAlign="center">{component.quantity}</Table.Cell>
                                                    <Table.Cell textAlign="center">{component.unitVolume}</Table.Cell>
                                                    <Table.Cell textAlign="center">${(component.totalVolume).toFixed(2)}</Table.Cell>
                                                    <Table.Cell textAlign="center">${(component.unitCost || 0).toFixed(2)}</Table.Cell>
                                                    <Table.Cell textAlign="center">${(component.totalCost || 0).toFixed(2)}</Table.Cell>
                                                  </Table.Row>
                                                ))}
                                              </Table.Body>
                                              <Table.Footer>
                                                <Table.Row>
                                                  <Table.HeaderCell colSpan="4" textAlign="right">
                                                    <strong>組合總體積:</strong>
                                                  </Table.HeaderCell>
                                                  <Table.HeaderCell textAlign="center">
                                                    <strong>{item.totalVolume}</strong>
                                                  </Table.HeaderCell>
                                                </Table.Row>
                                              </Table.Footer>
                                            </Table>
                                          </div>
                                        </Table.Cell>
                                      </Table.Row>
                                    )}
                                  </React.Fragment>
                                ))}
                              </Table.Body>
                            </Table>
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </React.Fragment>
                  ))}
                </Table.Body>
              </Table>
              {/* 分頁控制區域 */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2em' }}>
                  <Pagination
                    activePage={currentPage}
                    boundaryRange={1}
                    onPageChange={handlePageChange}
                    size="large"
                    siblingRange={1}
                    totalPages={totalPages}
                    ellipsisItem={{ content: <Icon name="ellipsis horizontal" />, icon: true }}
                    firstItem={{ content: <Icon name="angle double left" />, icon: true }}
                    lastItem={{ content: <Icon name="angle double right" />, icon: true }}
                    prevItem={{ content: <Icon name="angle left" />, icon: true }}
                    nextItem={{ content: <Icon name="angle right" />, icon: true }}
                  />
                </div>
              )}
            </div>
          ) : (
            <Segment placeholder>
              <Header icon>
                <Icon name="search" />
                尚未計算紙箱分配結果
              </Header>
              <Segment.Inline>
                <Button 
                  style={{ backgroundColor: '#C17767', color: '#000' }} 
                  onClick={() => setActiveTab(0)}
                >
                  返回上傳訂單
                </Button>
              </Segment.Inline>
            </Segment>
          )}
        </Tab.Pane>
      ),
    },
  ];

  // SKU 統計模態視窗
  const renderSkuStatsModal = () => {
    return (
      <Modal 
        open={isStatsModalOpen} 
        onClose={() => setIsStatsModalOpen(false)}
        size="large"
      >
        <Modal.Header>
          <Icon name="chart bar" /> SKU 統計數據
        </Modal.Header>
        <Modal.Content scrolling>
          <Table celled striped>
          <Table.Header>
            <Table.Row>
                <Table.HeaderCell>SKU</Table.HeaderCell>
                <Table.HeaderCell>商品名稱</Table.HeaderCell>
                <Table.HeaderCell>總數量</Table.HeaderCell>
                <Table.HeaderCell>單位成本</Table.HeaderCell> {/* 新增列 */}
                <Table.HeaderCell>總成本</Table.HeaderCell> {/* 新增列 */}
                <Table.HeaderCell>數據來源</Table.HeaderCell>
                <Table.HeaderCell>匹配狀態</Table.HeaderCell>
                <Table.HeaderCell>組合內容</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
            <Table.Body>{skuStats.map((stat, index) => (
                <React.Fragment key={index}>
                  <Table.Row warning={stat.matchStatus === '未匹配'}>
                    <Table.Cell>{stat.sku}</Table.Cell>
                    <Table.Cell>{stat.name}</Table.Cell>
                    <Table.Cell textAlign="center" style={{ position: 'relative' }}>
                      {stat.componentCount > 0 ? (
                        <>
                          <div>訂單數量: <strong>{stat.count}</strong></div>
                          <div>組合中使用: <strong style={{ color: '#ff8c00' }}>{stat.componentCount}</strong></div>
                          <div style={{ 
                            marginTop: '5px', 
                            padding: '3px 8px', 
                            backgroundColor: '#e8f4f8', 
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            總計: {stat.totalCount}
                          </div>
                        </>
                      ) : (
                        stat.count
                      )}
                    </Table.Cell>
                    <Table.Cell textAlign="center">
                        ${(stat.unitCost || 0).toFixed(2)}
                        </Table.Cell>
                        <Table.Cell textAlign="center">
                        ${(stat.totalCost || 0).toFixed(2)}
                    </Table.Cell>
                    <Table.Cell>
                      {stat.matchSource === 'bom' && (
                        <span style={{ color: 'green' }}>
                          <Icon name="table" /> BOM 表
                        </span>
                      )}
                      {stat.matchSource === 'custom' && (
                        <span style={{ color: '#ff8c00' }}>
                          <Icon name="cubes" /> 自訂義組合
                        </span>
                      )}
                      {stat.matchSource === 'none' && (
                        <span style={{ color: 'red' }}>
                          <Icon name="times circle" /> 未匹配
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {stat.matchStatus === '已匹配' ? (
                        <span style={{ color: 'green' }}>
                          <Icon name="check circle" /> 已匹配
                        </span>
                      ) : (
                        <span style={{ color: 'red' }}>
                          <Icon name="times circle" /> 未匹配
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {stat.matchSource === 'custom' && stat.components && stat.components.length > 0 ? (
                        <Button 
                          size="mini" 
                          color="orange" 
                          onClick={() => {
                            setActiveCustomStats(prev => ({
                              ...prev,
                              [stat.sku]: !prev[stat.sku]
                            }));
                          }}
                        >
                          <Icon name={activeCustomStats[stat.sku] ? 'angle up' : 'angle down'} />
                          {activeCustomStats[stat.sku] ? '收起詳情' : '查看詳情'}
                        </Button>
                      ) : (
                        '-'
                      )}
                    </Table.Cell>
                  </Table.Row>
                  {/* 自定義組合的詳細內容 */}
                  {stat.matchSource === 'custom' && 
                   activeCustomStats[stat.sku] && 
                   stat.components && 
                   stat.components.length > 0 && (
                    <Table.Row>
                      <Table.Cell colSpan="6" style={{ backgroundColor: '#fffbf0', padding: '0.5em 2em' }}>
                        <div style={{ margin: '10px 0' }}>
                          <Header as="h5" style={{ color: '#ff8c00' }}>
                            <Icon name="cubes" />
                            <Header.Content>「{stat.name}」包含以下商品：</Header.Content>
                          </Header>
                          <Table compact size="small">
                            <Table.Header>
                              <Table.Row>
                                <Table.HeaderCell>料號</Table.HeaderCell>
                                <Table.HeaderCell>BOM表名稱</Table.HeaderCell>
                                <Table.HeaderCell>數量</Table.HeaderCell>
                                <Table.HeaderCell>單位體積</Table.HeaderCell>
                                <Table.HeaderCell>總體積</Table.HeaderCell>
                              </Table.Row>
                            </Table.Header>
                            <Table.Body>
                              {stat.components.map((component, compIndex) => (
                                <Table.Row key={compIndex}>
                                  <Table.Cell>{component.productCode}</Table.Cell>
                                  <Table.Cell>{component.name}</Table.Cell>
                                  <Table.Cell textAlign="center">{component.quantity}</Table.Cell>
                                  <Table.Cell textAlign="center">{component.unitVolume}</Table.Cell>
                                  <Table.Cell textAlign="center">{component.totalVolume}</Table.Cell>
                                </Table.Row>
                              ))}
                            </Table.Body>
                          </Table>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </React.Fragment>
              ))}
            </Table.Body>
          </Table>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={() => setIsStatsModalOpen(false)}>關閉</Button>
        </Modal.Actions>
      </Modal>
    );
  };

  if (loading) {
    return (
      <Container>
        <Dimmer active>
          <Loader>載入中...</Loader>
        </Dimmer>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container>
        <Message warning>
          <Message.Header>需要登入</Message.Header>
          <p>您需要登入才能使用此功能</p>
        </Message>
      </Container>
    );
  }

  return (
    <Container style={{ marginTop: '2em', marginBottom: '2em' }}>
      <ToastContainer />
      <Header as="h2" icon textAlign="center">
        <Icon name="shipping fast" circular />
        <Header.Content>訂單商品數量統計暨出貨紙箱分配系統</Header.Content>
        <Header.Subheader>統計商品數量，並根據商品體積自動計算訂單所需的紙箱類型</Header.Subheader>
      </Header>
      
      <Segment raised style={{ backgroundColor: '#f9f9f9' }}>
        <Tab 
          menu={{ secondary: true, pointing: true }}
          panes={panes} 
          activeIndex={activeTab}
          onTabChange={(e, { activeIndex }) => setActiveTab(activeIndex)}
        />
      </Segment>
  
      {/* 渲染 SKU 統計模態視窗 */}
      {renderSkuStatsModal()}
    </Container>
  );
}

export default ShippingPage;