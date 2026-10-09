// ข้อมูลเครื่องพิมพ์ Ricoh 23 เครื่อง อ้างอิงจาก Sheet 'serial เครื่อง'
const RICOH_MACHINES = [
  {
    serial: "5323X941683",
    room: "ศูนย์ครู (อนุบาล)",
    model: "C600",
    ip: "172.17.31.8",
    note: "",
    isColor: true,
    tonerModel: "Ricoh C600 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "4443RC20066",
    room: "ศูนย์ครู (อนุบาล)",
    model: "IM 4000",
    ip: "172.17.31.9",
    note: "",
    isColor: false,
    tonerModel: "MP 6054S / Ricoh 6054",
    colors: ["K"]
  },
  {
    serial: "5823P700770",
    room: "ห้องประชุมกลาง (ประถม)",
    model: "M C251FWB",
    ip: "172.17.91.9",
    note: "",
    isColor: true,
    tonerModel: "Ricoh M C250 / C251 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "4443RC20060",
    room: "ห้องประชุมกลาง (ประถม)",
    model: "IM 4000",
    ip: "172.17.91.8",
    note: "",
    isColor: false,
    tonerModel: "MP 6054S / 31ST6054BLK",
    colors: ["K"]
  },
  {
    serial: "9173RB20195",
    room: "ห้องประชุมกลาง (ประถม)",
    model: "IM C4500",
    ip: "172.17.91.7",
    note: "",
    isColor: true,
    tonerModel: "IM C6010 / IM C6000 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "5323XA42065",
    room: "PC1",
    model: "C600",
    ip: "172.17.61.8",
    note: "",
    isColor: true,
    tonerModel: "Ricoh C600 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "5323XA42071",
    room: "PC2",
    model: "C600",
    ip: "172.17.61.9",
    note: "",
    isColor: true,
    tonerModel: "Ricoh C600 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "5323XA42070",
    room: "PC3",
    model: "C600",
    ip: "172.17.71.9",
    note: "",
    isColor: true,
    tonerModel: "Ricoh C600 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "5323X941720",
    room: "PC4",
    model: "C600",
    ip: "172.17.71.5",
    note: "",
    isColor: true,
    tonerModel: "Ricoh C600 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "5323ZA42066",
    room: "ธุรการ (ประถม)",
    model: "C600",
    ip: "172.17.71.7",
    note: "",
    isColor: true,
    tonerModel: "Ricoh C600 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "4443RC20088",
    room: "ธุรการ (ประถม)",
    model: "IM 4000",
    ip: "-",
    note: "",
    isColor: false,
    tonerModel: "MP 6054S / Ricoh 6054",
    colors: ["K"]
  },
  {
    serial: "59329600611",
    room: "ธุรการ (ประถม)",
    model: "SP C430DN",
    ip: "172.17.71.6",
    note: "",
    isColor: true,
    tonerModel: "SP C430 / C431 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "59329600595",
    room: "ธุรการ (ประถม)",
    model: "SP C430DN",
    ip: "172.17.71.10",
    note: "",
    isColor: true,
    tonerModel: "SP C430 / C431 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "5320X109082",
    room: "อำนวยการ (มัธยม)",
    model: "C600",
    ip: "172.17.115.9",
    note: "เตรียมคืน",
    isColor: true,
    tonerModel: "Ricoh C600 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "9154R130684",
    room: "อำนวยการ (มัธยม)",
    model: "IM C3010",
    ip: "172.17.115.8",
    note: "",
    isColor: true,
    tonerModel: "IM C3510 / C3010 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "4443RC20076",
    room: "อำนวยการ (มัธยม)",
    model: "IM 4000",
    ip: "-",
    note: "",
    isColor: false,
    tonerModel: "MP 6054S / Ricoh 6054",
    colors: ["K"]
  },
  {
    serial: "5323X941726",
    room: "การเงิน คลัง พัสดุ",
    model: "P C600",
    ip: "172.17.11.7",
    note: "",
    isColor: true,
    tonerModel: "Ricoh P C600 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "5323XA42058",
    room: "ห้องพักครู ชั้น 3 (มัธยม)",
    model: "P C600",
    ip: "172.17.21.9",
    note: "",
    isColor: true,
    tonerModel: "Ricoh P C600 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "5323XA42068",
    room: "ทะเบียน (มัธยม)",
    model: "P C600",
    ip: "172.17.112.11",
    note: "",
    isColor: true,
    tonerModel: "Ricoh P C600 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "5320X106066",
    room: "เลขา",
    model: "P C600",
    ip: "172.17.21.5",
    note: "เตรียมคืน",
    isColor: true,
    tonerModel: "Ricoh P C600 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "9173RB20165",
    room: "วิชาการ (มัธยม)",
    model: "IM C4510",
    ip: "172.17.112.6",
    note: "",
    isColor: true,
    tonerModel: "IM C6010 / IM C600 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "5823PA00137",
    room: "วิชาการ (มัธยม)",
    model: "M C251FWB",
    ip: "172.17.112.8",
    note: "",
    isColor: true,
    tonerModel: "Ricoh M C250 / C251 Series",
    colors: ["C", "M", "Y", "K"]
  },
  {
    serial: "C370PB00289",
    room: "อำนวยการ (มัธยม)",
    model: "MP 4054",
    ip: "-",
    note: "",
    isColor: false,
    tonerModel: "MP 6054S / Ricoh 4054 Series",
    colors: ["K"]
  }
];
