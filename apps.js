require("dotenv").config(); //environment variables for encryption
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(
  session({
    secret: "Don'tworry,IamtheStrongest.",
    resave: false,
    saveUninitialized: false,
    //   cookie: { secure: true }
  })
);
app.use(passport.initialize());
app.use(passport.session());

main().catch((err) => {
  console.log(err);
});
async function main() {
  mongoose.connect("mongodb://127.0.0.1:27017/userDB");
  const userSchema = new mongoose.Schema({
    username: String,
    googleId: String,
    password: String,
    secret: String
  });
  //////////////////////////// Schema plugin
  userSchema.plugin(passportLocalMongoose);
  userSchema.plugin(findOrCreate);
  const User = mongoose.model("User", userSchema);
  //////////////////////////// PASSPORT SERIALIZE DESERIALIZE
  passport.use(User.createStrategy());
  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser((id,done)=>{
    User.findById(id).then((user)=>{
        done(null,user)
    })
})
  
  //////////////////////////// GOOGLE AUTH
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/secrets",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
      },
      function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
          return cb(err, user);
        });
      }
    )
  );
  ///////////////////////////////////////////
  app.get("/", function (req, res) {
    res.render("home");
  });
  ///////////////////////////////////////// GOOGLE AUTH////////////////////////////////////////////
app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);
app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/secrets');
  });
  ///////////////////////////////////////// REGISTER //////////////////////////////////////////
  app.get("/register", function (req, res) {
    res.render("register");
  });
  app.post("/register", async function (req, res) {
    User.register(
      { username: req.body.username, active: true },
      req.body.password,
      function (err, user) {
        if (err) {
          console.log(err);
          res.redirect("/register");
        } else {
          passport.authenticate("local")(req, res, function () {
            res.redirect("/secrets");
          });
        }
      }
    );
  });

  ////////////////////////////////// LOGIN ///////////////////////////////////////////////////
  app.get("/login", function (req, res) {
    res.render("login");
  });
  app.post("/login", async function (req, res) {
    const newUser = new User({
      username: req.body.username,
      password: req.body.password,
    });

    req.login(newUser, function (err) {
      if (err) {
        console.log(err);
        res.redirect("/login");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    });
  });

  // app.get("/secrets", async function (req, res) {
  //   if (req.isAuthenticated()) {
  //     res.render("secrets");
  //   } else {
  //     res.redirect("/login");
  //   }
  // });
  app.get("/secrets", async function(req, res){
    const foundU= await User.find({"secret": {$ne: null}})
    if(foundU){
      res.render("secrets", {usersWithSecrets: foundU});
    } 
    else console.log("No secrets Found");

    });
  app.get("/logout", async function (req, res) {
    req.logOut(function (err) {
      if (err) {
        res.redirect("/");
        console.log(err);
      }
      res.redirect("/");
    });
  });
  app.get("/submit", function(req, res){
    if (req.isAuthenticated()){
      res.render("submit");
    } else {
      res.redirect("/login");
    }
  });  
  app.post("/submit", async function(req, res){
    const submittedSecret = req.body.secret;
  
  //Once the user is authenticated and their session gets saved, their user details are saved to req.user.
    // console.log(req.user.id);
  
    const foundUser = await User.findById(req.user.id)
    // , function(err, foundUser){
      if(foundUser){
        foundUser.secret = submittedSecret;
        await foundUser.save();
        res.redirect("/secrets");
      }else{ console.log("User not found");}
      // if (err) {
      //   console.log(err);
      // } else {
      //   if (foundUser) {
      //     foundUser.secret = submittedSecret;
      //     foundUser.save(function(){
      //       res.redirect("/secrets");
      //     });
      //   }
      // }
    });
  
}
app.listen(3000, function () {
  console.log("Server Running");
});
