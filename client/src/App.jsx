import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import "./App.css";

const API = "http://localhost:5000";

const objects = [
    "Account",
    "Opportunity",
    "Lead",
    "Contact",
    "Case"
];

const createFields = {
    Account: {
        Name: "",
        Phone: "",
        Website: "",
        Industry: ""
    },

    Opportunity: {
        Name: "",
        Amount: "",
        StageName: "Prospecting",
        CloseDate: ""
    },

    Lead: {
        FirstName: "",
        LastName: "",
        Company: "",
        Email: "",
        Phone: "",
        Status: "Open - Not Contacted"
    },

    Contact: {
        FirstName: "",
        LastName: "",
        Email: "",
        Phone: ""
    },

    Case: {
        Subject: "",
        Status: "New",
        Priority: "Medium"
    }
};

function App() {

    const [loggedIn, setLoggedIn] = useState(false);

    const [selectedObject, setSelectedObject] = useState("");

    const [records, setRecords] = useState([]);

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");

    const [nextRecordsUrl, setNextRecordsUrl] = useState(null);

    const [selectedRecord, setSelectedRecord] = useState(null);

    const [showView, setShowView] = useState(false);

    const [showEdit, setShowEdit] = useState(false);

    const [showCreate, setShowCreate] = useState(false);

    const [formData, setFormData] = useState({});

    const [saving, setSaving] = useState(false);


    // ==========================================
    // CHECK LOGIN
    // ==========================================

    useEffect(() => {
        checkLogin();
    }, []);


    const checkLogin = async () => {

        try {

            const response = await axios.get(
                `${API}/auth/status`,
                {
                    withCredentials: true
                }
            );

            setLoggedIn(response.data.loggedIn);

        } catch (error) {

            console.error(error);

        }
    };


    // ==========================================
    // LOGIN
    // ==========================================

    const login = () => {

        window.location.href =
            `${API}/auth/login`;

    };


    // ==========================================
    // LOGOUT
    // ==========================================

    const logout = async () => {

        try {

            await axios.get(
                `${API}/auth/logout`,
                {
                    withCredentials: true
                }
            );

            setLoggedIn(false);
            setRecords([]);
            setSelectedObject("");
            setNextRecordsUrl(null);

        } catch (error) {

            console.error(error);

        }
    };


    // ==========================================
    // LOAD FIRST 20 RECORDS
    // ==========================================

    const loadRecords = async (objectName) => {

        if (!objectName) {

            setRecords([]);
            setNextRecordsUrl(null);

            return;
        }

        setLoading(true);
        setError("");

        try {

            const response = await axios.get(
                `${API}/api/records`,
                {
                    params: {
                        object: objectName
                    },
                    withCredentials: true
                }
            );

            setRecords(response.data.records);

            setNextRecordsUrl(
                response.data.nextRecordsUrl
            );

        } catch (error) {

            console.error(error);

            setError(
                error.response?.data?.message ||
                "Failed to load records"
            );

        } finally {

            setLoading(false);

        }
    };


    // ==========================================
    // SELECT OBJECT
    // ==========================================

    const handleObjectChange = (event) => {

        const objectName = event.target.value;

        setSelectedObject(objectName);

        setRecords([]);

        setNextRecordsUrl(null);

        loadRecords(objectName);

    };


    // ==========================================
    // LOAD NEXT 20 RECORDS
    // ==========================================

    const loadMoreRecords = useCallback(async () => {

        if (!nextRecordsUrl || loading) {
            return;
        }

        setLoading(true);

        try {

            const response = await axios.get(
                `${API}/api/records/next`,
                {
                    params: {
                        url: nextRecordsUrl
                    },
                    withCredentials: true
                }
            );

            setRecords((previousRecords) => [
                ...previousRecords,
                ...response.data.records
            ]);

            setNextRecordsUrl(
                response.data.nextRecordsUrl
            );

        } catch (error) {

            console.error(error);

            setError(
                "Failed to load more records"
            );

        } finally {

            setLoading(false);

        }

    }, [nextRecordsUrl, loading]);


    // ==========================================
    // INFINITE SCROLL
    // ==========================================

    useEffect(() => {

        const handleScroll = () => {

            const scrollPosition =
                window.innerHeight +
                window.scrollY;

            const pageHeight =
                document.documentElement.scrollHeight;

            if (
                scrollPosition >= pageHeight - 200 &&
                nextRecordsUrl &&
                !loading
            ) {

                loadMoreRecords();

            }
        };

        window.addEventListener(
            "scroll",
            handleScroll
        );

        return () => {

            window.removeEventListener(
                "scroll",
                handleScroll
            );

        };

    }, [nextRecordsUrl, loading, loadMoreRecords]);


    // ==========================================
    // VIEW RECORD
    // ==========================================

    const handleView = (record) => {
        console.log("View clicked:", record);
        setSelectedRecord(record);
        setShowView(true);
    };

    // ==========================================
    // EDIT RECORD
    // ==========================================

    const handleEdit = (record) => {

        const editableData = { ...record };

        delete editableData.attributes;

        setSelectedRecord(record);

        setFormData(editableData);

        setShowEdit(true);

    };


    // ==========================================
    // FORM CHANGE
    // ==========================================

    const handleFormChange = (event) => {

        const {
            name,
            value
        } = event.target;

        setFormData((previousData) => ({
            ...previousData,
            [name]: value
        }));

    };


    // ==========================================
    // UPDATE RECORD
    // ==========================================

    const handleUpdate = async () => {

        if (!selectedRecord) {
            return;
        }

        setSaving(true);

        try {

            const updateData = { ...formData };

            delete updateData.Id;
            delete updateData.attributes;

            await axios.patch(
                `${API}/api/records/${selectedObject}/${selectedRecord.Id}`,
                updateData,
                {
                    withCredentials: true
                }
            );

            alert(
                "Record updated successfully!"
            );

            setShowEdit(false);

            await loadRecords(selectedObject);

        } catch (error) {

            console.error(error);

            alert(
                error.response?.data?.message ||
                "Failed to update record"
            );

        } finally {

            setSaving(false);

        }
    };


    // ==========================================
    // DELETE RECORD
    // ==========================================

    const handleDelete = async (record) => {

        const confirmed = window.confirm(
            `Are you sure you want to delete this ${selectedObject}?`
        );

        if (!confirmed) {
            return;
        }

        try {

            await axios.delete(
                `${API}/api/records/${selectedObject}/${record.Id}`,
                {
                    withCredentials: true
                }
            );

            alert(
                "Record deleted successfully!"
            );

            await loadRecords(selectedObject);

        } catch (error) {

            console.error(error);

            alert(
                error.response?.data?.message ||
                "Failed to delete record"
            );

        }
    };


    // ==========================================
    // OPEN CREATE FORM
    // ==========================================

    const handleCreateOpen = () => {

        setFormData({
            ...createFields[selectedObject]
        });

        setShowCreate(true);

    };


    // ==========================================
    // CREATE RECORD
    // ==========================================

    const handleCreate = async () => {

        setSaving(true);

        try {

            const cleanData = { ...formData };

            Object.keys(cleanData).forEach((key) => {

                if (cleanData[key] === "") {
                    delete cleanData[key];
                }

            });

            await axios.post(
                `${API}/api/records`,
                {
                    object: selectedObject,
                    fields: cleanData
                },
                {
                    withCredentials: true
                }
            );

            alert(
                "Record created successfully!"
            );

            setShowCreate(false);

            await loadRecords(selectedObject);

        } catch (error) {

            console.error(error);

            alert(
                error.response?.data?.message ||
                "Failed to create record"
            );

        } finally {

            setSaving(false);

        }
    };


    // ==========================================
    // LOGIN PAGE
    // ==========================================

    if (!loggedIn) {

        return (
            <div className="app">

                <h1>
                    Salesforce CRUD Web App
                </h1>

                <p>
                    Connect your Salesforce account
                    to continue.
                </p>

                <button onClick={login}>
                    Login with Salesforce
                </button>

            </div>
        );
    }


    // ==========================================
    // MAIN PAGE
    // ==========================================

    return (

        <div className="app">

            <div className="header">

                <h1>
                    Salesforce CRUD Web App
                </h1>

                <button onClick={logout}>
                    Logout
                </button>

            </div>


            {/* OBJECT DROPDOWN */}

            <div className="object-selector">

                <label>
                    Select Salesforce Object:
                </label>

                <select
                    value={selectedObject}
                    onChange={handleObjectChange}
                >

                    <option value="">
                        -- Select Object --
                    </option>

                    {objects.map((object) => (

                        <option
                            key={object}
                            value={object}
                        >
                            {object}
                        </option>

                    ))}

                </select>

            </div>


            {/* CREATE BUTTON */}

            {selectedObject && (

                <button
                    className="create-button"
                    onClick={handleCreateOpen}
                >
                    + Create {selectedObject}
                </button>

            )}


            {/* LOADING */}

            {loading && (

                <p>
                    Loading records...
                </p>

            )}


            {/* ERROR */}

            {error && (

                <p className="error">
                    {error}
                </p>

            )}


            {/* RECORDS */}

            {selectedObject &&
                !loading &&
                !error && (

                    <div className="records-section">

                        <h2>
                            {selectedObject} Records
                        </h2>


                        {records.length === 0 ? (

                            <p>
                                No records found.
                            </p>

                        ) : (

                            <div className="table-container">

                                <table>

                                    <thead>

                                        <tr>

                                            {Object.keys(
                                                records[0]
                                            )
                                                .filter(
                                                    (key) =>
                                                        key !==
                                                        "attributes"
                                                )
                                                .map(
                                                    (key) => (

                                                        <th key={key}>
                                                            {key}
                                                        </th>

                                                    )
                                                )}

                                            <th>
                                                Actions
                                            </th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        {records.map(
                                            (record) => (

                                                <tr
                                                    key={
                                                        record.Id
                                                    }
                                                >

                                                    {Object.keys(
                                                        record
                                                    )
                                                        .filter(
                                                            (key) =>
                                                                key !==
                                                                "attributes"
                                                        )
                                                        .map(
                                                            (key) => (

                                                                <td
                                                                    key={
                                                                        key
                                                                    }
                                                                >
                                                                    {
                                                                        record[
                                                                            key
                                                                        ] ??
                                                                        "-"
                                                                    }
                                                                </td>

                                                            )
                                                        )}


                                                    <td>

                                                        <button
                                                            onClick={() =>
                                                                handleView(
                                                                    record
                                                                )
                                                            }
                                                        >
                                                            View
                                                        </button>


                                                        <button
                                                            onClick={() =>
                                                                handleEdit(
                                                                    record
                                                                )
                                                            }
                                                        >
                                                            Edit
                                                        </button>


                                                        <button
                                                            onClick={() =>
                                                                handleDelete(
                                                                    record
                                                                )
                                                            }
                                                        >
                                                            Delete
                                                        </button>

                                                    </td>

                                                </tr>

                                            )
                                        )}

                                    </tbody>

                                </table>

                            </div>

                        )}

                    </div>

                )}


            {/* ==================================
                VIEW MODAL
            ================================== */}

            {showView && selectedRecord && (

                <div className="modal-overlay">

                    <div className="modal">

                        <h2>
                            View {selectedObject}
                        </h2>

                        {Object.keys(selectedRecord)
                            .filter(
                                (key) =>
                                    key !== "attributes"
                            )
                            .map((key) => (

                                <p key={key}>

                                    <strong>
                                        {key}:
                                    </strong>{" "}

                                    {selectedRecord[key] ?? "-"}

                                </p>

                            ))}

                        <button
                            onClick={() =>
                                setShowView(false)
                            }
                        >
                            Close
                        </button>

                    </div>

                </div>

            )}


            {/* ==================================
                EDIT MODAL
            ================================== */}

            {showEdit && (

                <div className="modal-overlay">

                    <div className="modal">

                        <h2>
                            Edit {selectedObject}
                        </h2>

                        {Object.keys(formData)
                            .filter(
                                (key) =>
                                    key !== "Id" &&
                                    key !== "attributes"
                            )
                            .map((key) => (

                                <div
                                    className="form-group"
                                    key={key}
                                >

                                    <label>
                                        {key}
                                    </label>

                                    <input
                                        type="text"
                                        name={key}
                                        value={
                                            formData[key] ??
                                            ""
                                        }
                                        onChange={
                                            handleFormChange
                                        }
                                    />

                                </div>

                            ))}

                        <button
                            onClick={handleUpdate}
                            disabled={saving}
                        >
                            {saving
                                ? "Saving..."
                                : "Save Changes"}
                        </button>

                        <button
                            onClick={() =>
                                setShowEdit(false)
                            }
                        >
                            Cancel
                        </button>

                    </div>

                </div>

            )}


            {/* ==================================
                CREATE MODAL
            ================================== */}

            {showCreate && (

                <div className="modal-overlay">

                    <div className="modal">

                        <h2>
                            Create {selectedObject}
                        </h2>

                        {Object.keys(formData)
                            .map((key) => (

                                <div
                                    className="form-group"
                                    key={key}
                                >

                                    <label>
                                        {key}
                                    </label>

                                    <input
                                        type={
                                            key ===
                                            "CloseDate"
                                                ? "date"
                                                : "text"
                                        }
                                        name={key}
                                        value={
                                            formData[key] ??
                                            ""
                                        }
                                        onChange={
                                            handleFormChange
                                        }
                                    />

                                </div>

                            ))}

                        <button
                            onClick={handleCreate}
                            disabled={saving}
                        >
                            {saving
                                ? "Creating..."
                                : "Create Record"}
                        </button>

                        <button
                            onClick={() =>
                                setShowCreate(false)
                            }
                        >
                            Cancel
                        </button>

                    </div>

                </div>

            )}

        </div>
    );
}

export default App;