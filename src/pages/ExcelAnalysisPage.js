import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import firebase from '../utils/firebase';
import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { Button, Tab, Message } from 'semantic-ui-react';
import ProfitAnalysis from '../components/ProfitAnalysis';

function ExcelAnalysisPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [manualInputs, setManualInputs] = useState({
    warehouseLogistics: 0,
    cardboardBox: 0,
    kbGiftCost: 0,
    khGiftCost: 0,
    thursdayRestockCost: 0,
    gift2800Cost: 0,
    gift3300Cost: 0,
  });
  const [taxInclusion, setTaxInclusion] = useState({
    averageActualAmount: true,
    paymentFee: true,
    cyberbizFee: true,
    warehouseLogistics: true
  });
  const [taxDeductionStatus, setTaxDeductionStatus] = useState({
    averageActualAmount: 'included',
    paymentFee: 'deductible',
    cyberbizFee: 'deductible',
    warehouseLogistics: 'included'
  });
  const [fileName, setFileName] = useState('');
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const chineseLabels = {
    kbGiftAverageCost: '康寶禮平均成本',
    khGiftAverageCost: '康熙禮平均成本',
    thursdayAverageCost: '周四補貨日平均成本',
    gift2800AverageCost: '2800滿額贈禮平均成本',
    gift3300AverageCost: '3300滿額贈禮平均成本',
    kolAverageCost: 'KOL分紅平均成本',
    discountAverageCost: '折價券,紅利,推薦碼平均成本',
    averageActualAmount: '平均實收訂單金額',
    paymentFee: '金流抽成2.2%',
    cyberbizFee: 'Cyberbiz抽成3%',
    warehouseLogistics: '倉儲+物流',
  };

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const excelDateToJSDate = useCallback((excelDate) => {
    const daysSince1900 = excelDate - 1;
    const millisecondsSince1900 = daysSince1900 * 24 * 60 * 60 * 1000;
    const date1900 = new Date(Date.UTC(1900, 0, 1));
  
    let jsDate = new Date(date1900.getTime() + millisecondsSince1900);
  
    if (excelDate > 60) {
      jsDate.setUTCDate(jsDate.getUTCDate() - 1);
    }
  
    jsDate = new Date(jsDate.getTime() + 8 * 60 * 60 * 1000);
    jsDate.setHours(0, 0, 0, 0);
    
    return jsDate;
  }, []);
  
  const isThursday = useCallback((excelDate) => {
    if (typeof excelDate !== 'number' || isNaN(excelDate)) {
      return false;
    }
  
    const date = excelDateToJSDate(excelDate);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 4;
  }, [excelDateToJSDate]);

  const calculateStats = useCallback((data, manualInputs, taxInclusion, taxDeductionStatus) => {
    if (!manualInputs) {
      console.error('manualInputs is undefined');
      return;
    }

    let totalOrders = 0;
    let kbGiftOrders = 0;
    let khGiftOrders = 0;
    let kolOrders = 0;
    let thursdayOrders = 0;
    let ordersOver2800 = 0;
    let ordersOver3300 = 0;
    let totalPreDiscountAmount = 0;
    let totalActualAmount = 0;
  
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
        totalOrders++;
  
        if (row[20] && row[20].includes('康寶禮')) kbGiftOrders++;
        if (row[20] && row[20].includes('康熙')) khGiftOrders++;
        if (row[28]) kolOrders++;
  
        const excelDate = row[0];

        if (excelDate && !isNaN(excelDate)) {
          if (isThursday(excelDate)) {
            thursdayOrders++;
          }
        } else {
          console.log(`Row ${i}: Invalid or missing date`);
        }
  
        const preDiscountAmount = (parseFloat(row[15]) || 0) + (parseFloat(row[24]) || 0) + 
                                  (parseFloat(row[26]) || 0) + (parseFloat(row[28]) || 0);
        totalPreDiscountAmount += preDiscountAmount;
  
        if (preDiscountAmount > 2800) ordersOver2800++;
        if (preDiscountAmount > 3300) ordersOver3300++;
  
        totalActualAmount += parseFloat(row[15]) || 0;
      }
    }
  
    const averagePreDiscountAmount = totalPreDiscountAmount / totalOrders;
    const averageActualAmount = totalActualAmount / totalOrders;
  
    const calculatedStats = {
      totalOrders,
      kbGiftOrders,
      khGiftOrders,
      kolOrders,
      thursdayOrders,
      ordersOver2800,
      ordersOver3300,
      averagePreDiscountAmount,
      averageActualAmount,
      paymentFee: 0.022 * averageActualAmount,
      cyberbizFee: 0.03 * averageActualAmount,
      kbGiftAverageCost: (manualInputs.kbGiftCost || 0) * (kbGiftOrders / totalOrders),
      khGiftAverageCost: (manualInputs.khGiftCost || 0) * (khGiftOrders / totalOrders),
      thursdayAverageCost: (manualInputs.thursdayRestockCost || 0) * (thursdayOrders / totalOrders),
      gift2800AverageCost: (manualInputs.gift2800Cost || 0) * (ordersOver2800 / totalOrders),
      gift3300AverageCost: (manualInputs.gift3300Cost || 0) * (ordersOver3300 / totalOrders),
      kolAverageCost: 70 * (kolOrders / totalOrders),
      discountAverageCost: averagePreDiscountAmount - averageActualAmount,
      warehouseLogistics: manualInputs.warehouseLogistics || 0,
    };
  
    Object.keys(calculatedStats).forEach(key => {
      if (typeof calculatedStats[key] === 'number' && 
          (key.endsWith('AverageCost') || 
           ['averageActualAmount', 'paymentFee', 'cyberbizFee', 'warehouseLogistics'].includes(key))) {
        const value = calculatedStats[key];
        const tax = taxInclusion[key] ? value * 0.05 : 0;
        calculatedStats[`${key}稅金`] = tax;
        
        if (taxDeductionStatus[key] === 'deductible') {
          calculatedStats[`${key}可扣稅`] = tax;
        } else if (taxDeductionStatus[key] === 'included') {
          calculatedStats[`${key}需含稅`] = tax;
        }
      }
    });
  
    const totalCost = calculatedStats.paymentFee + calculatedStats.cyberbizFee +
                      calculatedStats.kbGiftAverageCost + calculatedStats.khGiftAverageCost +
                      calculatedStats.thursdayAverageCost + calculatedStats.gift2800AverageCost +
                      calculatedStats.gift3300AverageCost + calculatedStats.kolAverageCost +
                      calculatedStats.discountAverageCost + calculatedStats.warehouseLogistics;
  
    const includedTax = Object.keys(calculatedStats)
      .filter(key => key.endsWith('需含稅'))
      .reduce((sum, key) => sum + calculatedStats[key], 0);
  
    const deductibleTax = Object.keys(calculatedStats)
      .filter(key => key.endsWith('可扣稅'))
      .reduce((sum, key) => sum + calculatedStats[key], 0);
  
    calculatedStats.totalCostWithTax = totalCost + includedTax - deductibleTax;
    calculatedStats.orderCostRate = calculatedStats.totalCostWithTax / calculatedStats.averagePreDiscountAmount;
  
    setStats(calculatedStats);
  }, [isThursday]);

  useEffect(() => {
    if (data.length > 0) {
      calculateStats(data, manualInputs, taxInclusion, taxDeductionStatus);
    }
  }, [data, manualInputs, taxInclusion, taxDeductionStatus, calculateStats]);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name.replace(/\.[^/.]+$/, ""));
    setData([]);
    setStats(null);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      setData(data);
      calculateStats(data, manualInputs, taxInclusion, taxDeductionStatus);
    };
    reader.readAsBinaryString(file);

    setShowSaveButton(true);
  }, [manualInputs, taxInclusion, taxDeductionStatus, calculateStats]);

  const handleManualInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setManualInputs(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  }, []);

  const handleTaxInclusionChange = useCallback((field) => (e) => {
    setTaxInclusion(prev => {
      const newTaxInclusion = { ...prev, [field]: e.target.checked };
      calculateStats(data, manualInputs, newTaxInclusion, taxDeductionStatus);
      return newTaxInclusion;
    });
  }, [data, manualInputs, taxDeductionStatus, calculateStats]);

  const handleTaxDeductionStatusChange = useCallback((field) => (e) => {
    setTaxDeductionStatus(prev => {
      const newTaxDeductionStatus = { ...prev, [field]: e.target.value };
      calculateStats(data, manualInputs, taxInclusion, newTaxDeductionStatus);
      return newTaxDeductionStatus;
    });
  }, [data, manualInputs, taxInclusion, calculateStats]);

  const handleSave = useCallback(async () => {
    if (!stats || !fileName) {
      toast.error('請確保已上傳文件並設置名稱');
      return;
    }

    try {
      const dataToSave = {
        fileName: fileName,
        stats: stats,
        manualInputs: manualInputs,
        taxInclusion: taxInclusion,
        taxDeductionStatus: taxDeductionStatus,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await firebase.firestore().collection('excelAnalysis').add(dataToSave);

      toast.success('數據已成功保存，等待重整頁面中', {
        duration: 1000,
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('儲存數據時出錯:', error);
      toast.error('儲存數據時出錯');
    }
  }, [stats, fileName, manualInputs, taxInclusion, taxDeductionStatus]);

  const handleViewSavedData = useCallback(() => {
    navigate('/saved-analysis');
  }, [navigate]);

  const renderOrderCostAnalysis = () => (
    <div style={styles.excelAnalysisPage}>
      <h1 style={styles.title}>訂單成本率分析</h1>
      
      <Button onClick={handleViewSavedData} style={styles.viewButton}>
        查看已保存的數據
      </Button>
      
      <div style={styles.manualInputs}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>倉儲+物流</label>
          <input
            type="number"
            name="warehouseLogistics"
            value={manualInputs.warehouseLogistics}
            onChange={handleManualInputChange}
            style={styles.input}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>紙箱</label>
          <input
            type="number"
            name="cardboardBox"
            value={manualInputs.cardboardBox}
            onChange={handleManualInputChange}
            style={styles.input}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>康寶禮成本</label>
          <input
            type="number"
            name="kbGiftCost"
            value={manualInputs.kbGiftCost}
            onChange={handleManualInputChange}
            style={styles.input}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>康熙禮成本</label>
          <input
            type="number"
            name="khGiftCost"
            value={manualInputs.khGiftCost}
            onChange={handleManualInputChange}
            style={styles.input}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>週四補貨日贈品成本</label>
          <input
            type="number"
            name="thursdayRestockCost"
            value={manualInputs.thursdayRestockCost}
            onChange={handleManualInputChange}
            style={styles.input}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>2800滿額贈禮成本</label>
          <input
            type="number"
            name="gift2800Cost"
            value={manualInputs.gift2800Cost}
            onChange={handleManualInputChange}
            style={styles.input}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>3300滿額贈禮成本</label>
          <input
            type="number"
            name="gift3300Cost"
            value={manualInputs.gift3300Cost}
            onChange={handleManualInputChange}
            style={styles.input}
          />
        </div>
      </div>
      <div>
        <h3 style={styles.notificationtext}>請先填寫完上面的數據後再匯入資料</h3>
        <input 
          type="file" 
          onChange={handleFileUpload} 
          accept=".xlsx, .xls" 
          style={styles.fileInput}
        />
      </div>
      
      {stats && (
        <div style={styles.stats}>
          <h2>統計結果</h2>
          <table style={styles.table}>
            <tbody>
              <tr style={styles.tableHeader}>
                <th style={styles.tableCell}>欄位</th>
                <th style={styles.tableCell}>數據</th>
              </tr>
              <tr style={styles.tableRow}>
                <td style={styles.tableCell}>總訂單數</td>
                <td style={styles.tableCell}>{stats.totalOrders}</td>
              </tr>
              <tr style={styles.tableRowAlternate}>
                <td style={styles.tableCell}>康寶禮訂單數</td>
                <td style={styles.tableCell}>{stats.kbGiftOrders}</td>
              </tr>
              <tr style={styles.tableRow}>
                <td style={styles.tableCell}>康熙禮訂單數</td>
                <td style={styles.tableCell}>{stats.khGiftOrders}</td>
              </tr>
              <tr style={styles.tableRowAlternate}>
                <td style={styles.tableCell}>KOL推薦碼使用次數</td>
                <td style={styles.tableCell}>{stats.kolOrders}</td>
              </tr>
              <tr style={styles.tableRow}>
                <td style={styles.tableCell}>週四下單訂單數</td>
                <td style={styles.tableCell}>{stats.thursdayOrders}</td>
              </tr>
              <tr style={styles.tableRowAlternate}>
                <td style={styles.tableCell}>折扣前金額 {'>'} 2800 訂單數</td>
                <td style={styles.tableCell}>{stats.ordersOver2800}</td>
              </tr>
              <tr style={styles.tableRow}>
                <td style={styles.tableCell}>折扣前金額 {'>'} 3300 訂單數</td>
                <td style={styles.tableCell}>{stats.ordersOver3300}</td>
              </tr>
              <tr style={styles.tableRowAlternate}>
                <td style={styles.tableCell}>折扣前平均訂單金額</td>
                <td style={styles.tableCell}>{stats.averagePreDiscountAmount.toFixed(2)} 元</td>
              </tr>
              {Object.entries(stats).map(([key, value], index) => {
                const chineseLabel = chineseLabels[key] || key;
                if (['averageActualAmount', 'paymentFee', 'cyberbizFee', 'warehouseLogistics'].includes(key)) {
                  return (
                    <React.Fragment key={key}>
                      <tr style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}>
                        <td style={styles.tableCell}>{chineseLabel}</td>
                        <td style={styles.tableCell}>
                          {value.toFixed(2)} 元
                          <div style={styles.checkboxGroup}>
                            <input
                              type="checkbox"
                              checked={taxInclusion[key]}
                              onChange={handleTaxInclusionChange(key)}
                              style={styles.checkbox}
                            />
                            <label>含稅</label>
                          </div>
                        </td>
                      </tr>
                      {taxInclusion[key] && (
                        <tr style={index % 2 === 0 ? styles.tableRowAlternate : styles.tableRow}>
                          <td style={styles.tableCell}>{chineseLabel}稅金 (5%)</td>
                          <td style={styles.tableCell}>
                            {(value * 0.05).toFixed(2)} 元 &nbsp;&nbsp;
                            <select
                              value={taxDeductionStatus[key]}
                              onChange={handleTaxDeductionStatusChange(key)}
                              style={styles.select}
                            >
                              <option value="">選擇稅金狀態</option>
                              <option value="deductible">可扣稅</option>
                              <option value="included">需含稅</option>
                            </select>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                } else if (key.endsWith('AverageCost')) {
                  return (
                    <tr key={key} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}>
                      <td style={styles.tableCell}>{chineseLabel}</td>
                      <td style={styles.tableCell}>
                        {value.toFixed(2)} 元
                      </td>
                    </tr>
                  );
                }
                return null;
              })}
              <tr style={styles.tableRow}>
                <td style={styles.tableCell}>成本TTL(含稅)</td>
                <td style={styles.tableCell}>{stats.totalCostWithTax.toFixed(2)} 元</td>
              </tr>
              <tr style={styles.tableRowAlternate}>
                <td style={styles.tableCell}>訂單成本率</td>
                <td style={styles.tableCell}>{(stats.orderCostRate * 100).toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {showSaveButton && (
        <div style={styles.saveSection}>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="輸入名稱"
            style={styles.input}
          />
          <button onClick={handleSave} style={styles.saveButton}>
            儲存
          </button>
        </div>
      )}
    </div>
  );

  const renderProfitAnalysis = () => <ProfitAnalysis />;

  const panes = [
    { menuItem: '訂單成本率分析', render: () => <Tab.Pane>{renderOrderCostAnalysis()}</Tab.Pane> },
    { menuItem: '毛利分析', render: () => <Tab.Pane>{renderProfitAnalysis()}</Tab.Pane> },
  ];

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <Message error>
        <Message.Header>需要登入</Message.Header>
        <p>您需要登入才能查看此頁面。請 &nbsp;&nbsp; <Button color="red" as={Link} to="/signin">登入</Button></p>
      </Message>
    );
  }

  return (
    <div>
      <Toaster position="top-right" />
      <Tab 
        panes={panes} 
        activeIndex={activeTab}
        onTabChange={(e, { activeIndex }) => setActiveTab(activeIndex)}
      />
    </div>
  );
}

export default ExcelAnalysisPage;

// 樣式定義
const styles = {
  notificationtext: {
    color: "red"
  },
  excelAnalysisPage: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  title: {
    color: '#333',
    marginBottom: '20px',
  },
  fileInput: {
    marginBottom: '20px',
  },
  manualInputs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
    marginBottom: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    marginBottom: '5px',
  },
  input: {
    padding: '5px',
    borderRadius: '3px',
    border: '1px solid #ccc',
  },
  stats: {
    marginTop: '20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '20px',
  },
  tableCell: {
    border: '1px solid #ddd',
    padding: '8px',
    textAlign: 'left',
  },
  tableRow: {
    backgroundColor: '#f2f2f2',
  },
  tableRowAlternate: {
    backgroundColor: '#ffffff',
  },
  checkboxGroup: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '5px',
  },
  checkbox: {
    marginRight: '5px',
  },
  select: {
    padding: '5px',
    borderRadius: '3px',
    border: '1px solid #ccc',
    marginTop: '5px',
  },
  saveSection: {
    marginTop: '20px',
    display: 'flex',
    alignItems: 'center',
  },
  saveButton: {
    padding: '10px 15px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginLeft: '10px',
  },
  viewButton: {
    marginBottom: '20px',
    backgroundColor: '#2185d0',
    color: 'white',
    border: 'none',
    padding: '10px 15px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};