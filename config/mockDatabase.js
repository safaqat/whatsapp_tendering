// In-memory mock database for demo purposes
const tenders = [];
const bids = [];
const suppliers = [
  { id: 1, phone: 'whatsapp:+96811111111', name: 'Supplier One', language: 'English', is_active: true },
  { id: 2, phone: 'whatsapp:+96822222222', name: 'Supplier Two', language: 'Arabic', is_active: true },
  { id: 3, phone: 'whatsapp:+96833333333', name: 'Supplier Three', language: 'Hindi', is_active: true }
];
const notifications = [];
const clients = [];

module.exports = {
  tenders,
  bids,
  suppliers,
  notifications,
  clients,
  // CRUD for tenders
  addTender: (tender) => { tenders.push(tender); return tender; },
  getTenders: () => [...tenders],
  getTenderById: (tender_id) => tenders.find(t => t.tender_id === tender_id),
  // CRUD for bids
  addBid: (bid) => { bids.push(bid); return bid; },
  getBids: () => [...bids],
  getBidsByTender: (tender_id) => bids.filter(b => b.tender_id === tender_id),
  getBidById: (bid_id) => bids.find(b => b.id === bid_id),
  updateBidStatus: (bid_id, status) => {
    const bid = bids.find(b => b.id === bid_id);
    if (bid) bid.status = status;
    return bid;
  },
  // Suppliers
  getActiveSuppliers: () => suppliers.filter(s => s.is_active),
  getSupplierById: (id) => suppliers.find(s => s.id == id),
  getSupplierByPhone: (phone) => suppliers.find(s => s.phone === phone),
  // Notifications
  addNotification: (notif) => { notifications.push(notif); return notif; },
  getNotifications: () => [...notifications],
  addClient: (client) => { clients.push(client); return client; },
  getClients: () => [...clients],
  getClientById: (id) => clients.find(c => c.id == id),
  updateClient: (id, data) => {
    const client = clients.find(c => c.id == id);
    if (client) Object.assign(client, data);
    return client;
  },
  deleteClient: (id) => {
    const idx = clients.findIndex(c => c.id == id);
    if (idx !== -1) clients.splice(idx, 1);
  }
}; 