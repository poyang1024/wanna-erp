import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import firebase from '../utils/firebase';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { Button } from 'semantic-ui-react';

function ExcelAnalysisPage() {
  const navigate = useNavigate();
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
  const [taxInclusion, setTaxInclusion] = useState({});
  const [taxDeductionStatus, setTaxDeductionStatus] = useState({});
  const [fileName, setFileName] = useState('');
  const [showSaveButton, setShowSaveButton] = useState(false);
  const handleViewSavedData = () => {
    navigate('/saved-analysis');
  };

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

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 設置文件名（不包括擴展名）
    setFileName(file.name.replace(/\.[^/.]+$/, ""));

    // 重置所有相關狀態
    setData([]);
    setStats(null);
    setTaxInclusion({});
    setTaxDeductionStatus({});
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      setData(data);
      calculateStats(data, manualInputs, {}, {});
    };
    reader.readAsBinaryString(file);

    // 顯示儲存按鈕
    setShowSaveButton(true);
  };

  const handleManualInputChange = (e) => {
    const { name, value } = e.target;
    setManualInputs(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const handleTaxInclusionChange = (field) => (e) => {
    setTaxInclusion(prev => {
      const newTaxInclusion = { ...prev, [field]: e.target.checked };
      calculateStats(data, manualInputs, newTaxInclusion, taxDeductionStatus);
      return newTaxInclusion;
    });
  };

  const handleSave = async () => {
    if (!stats || !fileName) {
      toast.error('請確保已上傳文件並設置名稱');
      return;
    }

    try {
      // 準備要保存的數據
      const dataToSave = {
        fileName: fileName,
        stats: stats,
        manualInputs: manualInputs,
        taxInclusion: taxInclusion,
        taxDeductionStatus: taxDeductionStatus,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // 保存到 Firebase
      await firebase.firestore().collection('excelAnalysis').add(dataToSave);

      toast.success('數據已成功保存到 Firebase', {
        duration: 3000,
        onClose: () => {
          // 重新載入頁面
          window.location.reload();
        }
      });
    } catch (error) {
      console.error('保存到 Firebase 時出錯:', error);
      toast.error('保存數據時出錯');
    }
  };

  const handleTaxDeductionStatusChange = (field) => (e) => {
    setTaxDeductionStatus(prev => {
      const newTaxDeductionStatus = { ...prev, [field]: e.target.value };
      calculateStats(data, manualInputs, taxInclusion, newTaxDeductionStatus);
      return newTaxDeductionStatus;
    });
  };

  const excelDateToJSDate = (excelDate) => {
    // Excel 的日期系統從 1900 年 1 月 1 日開始
    const daysSince1900 = excelDate - 1; // 減 1 是因為 Excel 將 1900/1/1 視為 1
    const millisecondsSince1900 = daysSince1900 * 24 * 60 * 60 * 1000;
    const date1900 = new Date(Date.UTC(1900, 0, 1)); // UTC 時間 1900 年 1 月 1 日
  
    let jsDate = new Date(date1900.getTime() + millisecondsSince1900);
  
    // 調整 Excel 的 1900 年閏年錯誤
    if (excelDate > 60) { // 60 是 Excel 中的 1900 年 2 月 29 日（實際上不存在）
      jsDate.setUTCDate(jsDate.getUTCDate() - 1);
    }
  
    // 調整為本地時區（假設是 UTC+8）
    jsDate = new Date(jsDate.getTime() + 8 * 60 * 60 * 1000);
  
    // 設置時間為當天的午夜（本地時間）
    jsDate.setHours(0, 0, 0, 0);
  
    // console.log(`Excel date ${excelDate} converted to JS date: ${jsDate.toISOString()}`);
    
    return jsDate;
  };
  
  const isThursday = (excelDate) => {
    // console.log(`Checking if date is Thursday: ${excelDate}`);
    
    if (typeof excelDate !== 'number' || isNaN(excelDate)) {
      // console.log(`Invalid Excel date format: ${excelDate}`);
      return false;
    }
  
    const date = excelDateToJSDate(excelDate);
    const dayOfWeek = date.getDay();
    const isThurs = dayOfWeek === 4;
    // console.log(`Date: ${date.toISOString()}, Day of week: ${dayOfWeek}, Is Thursday: ${isThurs}`);
    return isThurs;
  };

  const calculateStats = (data, manualInputs, taxInclusion, taxDeductionStatus) => {

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
  
        // 改進的週四訂單判斷邏輯
        const excelDate = row[0];
        // console.log(`Row ${i}: Date string:`, orderDateStr);

        if (excelDate && !isNaN(excelDate)) {
          if (isThursday(excelDate)) {
            thursdayOrders++;
            // console.log(`Row ${i}: Thursday order found:`, orderDateStr);
          } else {
            // console.log(`Row ${i}: Not a Thursday order:`, orderDateStr);
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

    // console.log('Total Thursday orders:', thursdayOrders);
  
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
  
    // Calculate tax for all relevant fields
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
  
    // Calculate total cost and order cost rate
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
  };

  useEffect(() => {
    if (data.length > 0) {
      calculateStats(data, manualInputs, taxInclusion, taxDeductionStatus);
    }
  }, [data, manualInputs, taxInclusion, taxDeductionStatus]);


  return (
    <div style={styles.excelAnalysisPage}>
      <Toaster position="top-right" />
      <h1 style={styles.title}>訂單數據分析</h1>
      
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
                <th style={styles.tableCell}>數值</th>
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
              {/* <tr style={styles.tableRow}>
                <td style={styles.tableCell}>平均實收訂單金額</td>
                <td style={styles.tableCell}>{stats.averageActualAmount.toFixed(2)} 元</td>
              </tr> */}
              {Object.entries(stats).map(([key, value], index) => {
                if (typeof value === 'number' && 
                    (key.endsWith('AverageCost') || 
                     ['averageActualAmount', 'paymentFee', 'cyberbizFee', 'warehouseLogistics'].includes(key))) {
                  const chineseLabel = chineseLabels[key] || key;
                  return (
                    <React.Fragment key={key}>
                      <tr style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}>
                        <td style={styles.tableCell}>{chineseLabel}</td>
                        <td style={styles.tableCell}>
                          {value.toFixed(2)} 元
                          <div style={styles.checkboxGroup}>
                            <input
                              type="checkbox"
                              checked={taxInclusion[key] || false}
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
                            {(value * 0.05).toFixed(2)} 元
                            <select
                              value={taxDeductionStatus[key] || ''}
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
                }
                return null;
              })}
              {/* <tr style={styles.tableRow}>
                <td style={styles.tableCell}>金流抽成2.2%</td>
                <td style={styles.tableCell}>{stats.paymentFee.toFixed(2)} 元</td>
              </tr>
              <tr style={styles.tableRowAlternate}>
                <td style={styles.tableCell}>Cyberbiz抽成3%</td>
                <td style={styles.tableCell}>{stats.cyberbizFee.toFixed(2)} 元</td>
              </tr> */}
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
          placeholder="輸入保存名稱"
          style={styles.input}
        />
        <button onClick={handleSave} style={styles.saveButton}>
          儲存到 Firebase
        </button>
      </div>
    )}
    </div>
  );
}

export default ExcelAnalysisPage;


  // 樣式定義
  const styles = {
    notificationtext:{
      color:"red"
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