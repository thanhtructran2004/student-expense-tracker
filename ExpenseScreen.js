import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

// 🔹 Week number helper
function getWeekNumber(date) {
  const first = new Date(date.getFullYear(), 0, 1);
  const diff = date - first;
  return Math.floor((diff / 86400000 + first.getDay()) / 7);
}

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  // Filter
  const [filter, setFilter] = useState("ALL");

  // Totals
  const [total, setTotal] = useState(0);
  const [categoryTotals, setCategoryTotals] = useState({});

  // Editing state
  const [editing, setEditing] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');

  // Load expenses
  const loadExpenses = async () => {
    const rows = await db.getAllAsync(
      'SELECT * FROM expenses ORDER BY id DESC;'
    );
    setExpenses(rows);
  };

  // Add new expense
  const addExpense = async () => {
    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) return;

    const trimmedCategory = category.trim();
    const trimmedNote = note.trim();
    if (!trimmedCategory) return;

    const today = new Date().toISOString().slice(0, 10);

    await db.runAsync(
      'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
      [amountNumber, trimmedCategory, trimmedNote || null, today]
    );

    setAmount('');
    setCategory('');
    setNote('');

    loadExpenses();
  };

  const deleteExpense = async (id) => {
    await db.runAsync('DELETE FROM expenses WHERE id = ?;', [id]);
    loadExpenses();
  };

  // 🔹 Start editing a row
  const startEdit = (expense) => {
    setEditing(expense);
    setEditAmount(String(expense.amount));
    setEditCategory(expense.category);
    setEditNote(expense.note || '');
  };

  // 🔹 Save edited expense
  const saveEdit = async () => {
    const amountNumber = parseFloat(editAmount);

    if (isNaN(amountNumber) || amountNumber <= 0) return;
    if (!editCategory.trim()) return;

    await db.runAsync(
      `UPDATE expenses
       SET amount = ?, category = ?, note = ?
       WHERE id = ?;`,
      [amountNumber, editCategory.trim(), editNote.trim() || null, editing.id]
    );

    setEditing(null); // close modal
    loadExpenses();
  };

  // Filter logic
  const now = new Date();
  const filteredExpenses = expenses.filter(e => {
    const d = new Date(e.date);

    if (filter === "ALL") return true;
    if (filter === "WEEK")
      return getWeekNumber(d) === getWeekNumber(now) &&
             d.getFullYear() === now.getFullYear();
    if (filter === "MONTH")
      return d.getMonth() === now.getMonth() &&
             d.getFullYear() === now.getFullYear();

    return true;
  });

  // Total spending effect
  useEffect(() => {
    const sum = filteredExpenses.reduce(
      (acc, e) => acc + Number(e.amount),
      0
    );
    setTotal(sum);
  }, [filteredExpenses]);

  // Category totals effect
  useEffect(() => {
    const totals = {};
    filteredExpenses.forEach(e => {
      if (!totals[e.category]) totals[e.category] = 0;
      totals[e.category] += Number(e.amount);
    });
    setCategoryTotals(totals);
  }, [filteredExpenses]);

  // Render each row
  const renderExpense = ({ item }) => (
    <TouchableOpacity onPress={() => startEdit(item)}>
      <View style={styles.expenseRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.expenseAmount}>${Number(item.amount).toFixed(2)}</Text>
          <Text style={styles.expenseCategory}>{item.category}</Text>
          {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
          <Text style={{ color: '#9ca3af', fontSize: 11 }}>{item.date}</Text>
        </View>

        <TouchableOpacity onPress={() => deleteExpense(item.id)}>
          <Text style={styles.delete}>✕</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Initialize DB
  useEffect(() => {
    async function setup() {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          note TEXT,
          date TEXT NOT NULL
        );
      `);
      loadExpenses();
    }
    setup();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Student Expense Tracker</Text>

      {/* Filter buttons */}
      <View style={styles.filterRow}>
        <Button title="All" onPress={() => setFilter("ALL")} />
        <Button title="This Week" onPress={() => setFilter("WEEK")} />
        <Button title="This Month" onPress={() => setFilter("MONTH")} />
      </View>

      {/* Total spending */}
      <Text style={styles.totalText}>
        Total Spending ({filter === "ALL" ? "All" : filter === "WEEK" ? "This Week" : "This Month"}):
        ${total.toFixed(2)}
      </Text>

      {/* Category totals */}
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.categoryHeading}>
          By Category ({filter === "ALL" ? "All" : filter === "WEEK" ? "This Week" : "This Month"}):
        </Text>

        {Object.keys(categoryTotals).length === 0 ? (
          <Text style={styles.categoryEmpty}>No expenses in this filter.</Text>
        ) : (
          Object.entries(categoryTotals).map(([cat, amt]) => (
            <Text key={cat} style={styles.categoryItem}>
              • {cat}: ${amt.toFixed(2)}
            </Text>
          ))
        )}
      </View>

      {/* Add expense form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Amount (e.g. 12.50)"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Category (Food, Books, Rent...)"
          placeholderTextColor="#9ca3af"
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          style={styles.input}
          placeholder="Note (optional)"
          placeholderTextColor="#9ca3af"
          value={note}
          onChangeText={setNote}
        />
        <Button title="Add Expense" onPress={addExpense} />
      </View>

      {/* Edit modal */}
      {editing && (
        <View style={styles.editModal}>
          <Text style={styles.editTitle}>Edit Expense</Text>

          <TextInput
            style={styles.input}
            value={editAmount}
            onChangeText={setEditAmount}
            keyboardType="numeric"
          />

          <TextInput
            style={styles.input}
            value={editCategory}
            onChangeText={setEditCategory}
          />

          <TextInput
            style={styles.input}
            value={editNote}
            onChangeText={setEditNote}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <Button title="Cancel" onPress={() => setEditing(null)} />
            <Button title="Save" onPress={saveEdit} />
          </View>
        </View>
      )}

      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={
          <Text style={styles.empty}>No expenses yet.</Text>
        }
      />

      <Text style={styles.footer}>
        Enter your expenses and they’ll be saved locally with SQLite.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#111827' },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 12,
  },
  totalText: {
    color: "#fbbf24",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  categoryHeading: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  categoryItem: {
    color: "#e5e7eb",
    fontSize: 15,
    marginLeft: 10,
    marginBottom: 2,
  },
  categoryEmpty: {
    color: "#9ca3af",
    textAlign: "center",
    fontSize: 14,
  },
  form: {
    marginBottom: 16,
    gap: 8,
  },
  input: {
    padding: 10,
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fbbf24',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  expenseNote: {
    fontSize: 12,
    color: '#9ca3af',
  },
  delete: {
    color: '#f87171',
    fontSize: 20,
    marginLeft: 12,
  },
  empty: {
    color: '#9ca3af',
    marginTop: 24,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
    fontSize: 12,
  },
  editModal: {
    position: 'absolute',
    top: '25%',
    left: '5%',
    right: '5%',
    padding: 20,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    zIndex: 10,
  },
  editTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
});
