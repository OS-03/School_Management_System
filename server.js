const express = require("express");
const mysql = require("mysql2");
const dotenv = require("dotenv");
const bodyParser = require('body-parser');
const path = require('path');
const methodoverride = require('method-override');
const logger = require("morgan");
const ejsMate = require("ejs-mate");
const cors = require('cors');
const app = express();

//middleware to show static files
app.use(express.static(path.join(__dirname, "./public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodoverride("_method"));
app.engine("ejs", ejsMate);
app.use(logger("dev")); // Use morgan middleware for logging HTTP requests
// parse application/json // parse application/x-www-form-urlencoded
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
dotenv.config({});
app.use(cors());

// Create the connection to database
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password:process.env.DB_PASS,
  database: 'school_management_system',
});
//Check the connection
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.stack);
        return;
    }
    console.log('MySQL Connection Successful!');
});

// A simple SELECT query
// connection.query(
//   'SELECT * FROM schools;',
//   function (err, results, fields) {
//     console.log(results); // results contains rows returned by server
//     console.log(fields); // fields contains extra meta data about results, if available
//   }
// );

app.get('/',(req,res)=>{
    res.send("Server Up and Running!");
});

// post API
app.post('/addSchool',(req,res)=>{
    // destructure from body
    let {name, address, latitude, longitude} = req.body;
    if(!name || !address || !latitude || !longitude){
         return res.status(400).json({
                message: "Missing Fields",
                success: false
            });
    };
    if (typeof name !== 'string' || name.trim() === '' ||
        typeof address !== 'string' || address.trim() === '' ||
        isNaN(Number(latitude)) || isNaN(Number(longitude))) {
        return res.status(400).json({
            message: "Invalid field types or empty values",
            success: false
        });
    }

        // Insert Data in school database via the following query here (id) is set to auto_increment
        const sql = 'INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)';
        connection.query(sql, [name, address, latitude, longitude], (err, results) => {
            if (err) {
                console.log("Error inserting school:", err);
                return res.status(500).json({ message: "Database error", success: false });
            }
            res.json({ message: "School added", success:true, id: results.insertId });
        });
});

// Get all Schools based on latitude and longitude and sort them based on user's distance
app.get('/listSchools',(req,res)=>{
    const {latitude:userLat, longitude:userLon } = req.query;
      // Validate query parameters
    if (!userLat || !userLon || isNaN(Number(userLat)) || isNaN(Number(userLon))) {
        return res.status(400).json({
            message: "Invalid or missing latitude/longitude parameters",
            success: false
        });
    }

    //Fetch all the Schools 
  const sql = 'SELECT id, name, address, latitude, longitude FROM schools';
  connection.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching schools:", err);
      return res.status(500).json({ message: "Database error", success: false });
    }

    // Now using Haversine Formula to calculate the distance between coordinates
    const calculateDist = (lat1, lon1, lat2, lon2)=>{
        //To convert degree -> radians
        const toRad = (degree)=> degree * (Math.PI / 180);
        const R = 6371; // radius of Earth in kilometers
        const disLat = toRad(lat2 - lat1);
        const disLon = toRad(lon2 - lon1);
        // Now using the Formula
        const a = Math.sin(disLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))*Math.sin(disLon/2)**2;

        const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    //now sorting and calculating the distance
    const sortedSchools = results.map(school => {
        const dist = calculateDist(
            Number(userLat),
            Number(userLon),
            Number(school.latitude),
            Number(school.longitude)
        );
        return {...school, dist};
    }).sort((a,b)=>a.dist - b.dist); // after mapping all schools it is sorted based on smallest distance

    res.json({ message: "Schools fetched successfully", success: true, schools: sortedSchools });
       });

});


// error handling middleware
app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something Went Wrong!" } = err;
  console.error(err);
  res.status(statusCode).json({ error: message }); // Ensure JSON response for errors
});

app.listen(process.env.PORT,()=>{
    console.log(`Listening at port ${process.env.PORT}`);
})
 
