if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}

const axios = require('axios');
const express = require('express');
const app = express();
const ejsMate = require('ejs-mate');
const path = require('path')
const ejs = require('ejs');
const req = require('express/lib/request');
const session = require('express-session');
const mongoose = require('mongoose');
const flash = require('connect-flash')
const User = require('./models/user')
const Review = require('./models/review');
const Favourite = require('./models/favourites.js')
const passport = require('passport')
const ExpressError = require('./views/utils/ExpressError');
const catchAsync = require('./views/utils/catchAsync');
const LocalStrategy = require('passport-local');
const { use } = require('passport/lib');

const dbUrl = process.env.DB_URL || "mongodb://localhost:27017/bookWorm";

	    mongoose.connect(dbUrl, {
            useNewUrlParser: true, 
            useUnifiedTopology: true
        })
                   
        const db = mongoose.connection;
        db.on('error', console.error.bind(console, "connection error"));
        db.once("open", () => {
            console.log("Database Connected")
        })
            


const sessionOptions = {secret: 'thisisnotagoodsecret', resave: false , saveUninitialized: true}
app.use(session(sessionOptions));
app.engine('ejs',ejsMate);
app.set('view engine', 'ejs');
app.set('views',path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()))
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    // in req.user, we have information of the user which is currently logged in. If the user is not logged in, req.user is undefined. So, we can use it to display and undisplay the 'Login' and 'Logout' links from navbar depending upon whether a user is logged in or not. We can do this by sending 'req.user' to all the templates by setting a property 'currentUser' to be equal to 'req.user' on 'req.locals' and put this in a middleware
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
})

const isLoggedIn = (req, res, next) => {
    if(!req.isAuthenticated()){
        // 'req.originalUrl' stores the URL of previous link/route where we came from. We save it as 'returnTo' inside session. 
        req.flash('error', 'you must be signed in');
        return res.redirect('/bookworm/login');
    }
    next();
 }


app.get('/', (req, res)=>{
    let categories =    ['art','biographies','biology','chemistry','children','design','entrepreneurship','exercise','fantasy',
                        'film','finance','horror','history','literature','magic','management','mathematics','medicine','nutrition',
                        'physics','poetry','plays','programming','recipes','romance','science','textbooks','thriller'];    
    res.render('bookworm/index',{categories});  
})

app.get('/bookworm/subject/:category', async (req, res) => {
    const {category} = req.params;
    const categorySearchResult = await axios.get(`https://openlibrary.org/subjects/${category}.json?limit=100`);
    const categoryResult = categorySearchResult.data.works;
    req.session.returnTo = req.originalUrl;
    res.render('bookworm/subject',{categoryResult, category});
})


app.post('/bookworm', async (req, res)=>{
    let searchQuery = req.body.search;
    const searchResult = await axios.get(`https://openlibrary.org/search.json?q=${searchQuery}`); 
    const searchDocs = searchResult.data.docs;
    req.session.returnTo = req.originalUrl;
    res.render('bookworm/books', {searchDocs, searchQuery});
})



app.get('/bookworm/view/book/:workId', async (req, res) => {
    const {workId} = req.params;
    const workInfo = await axios.get(`https://openlibrary.org/works/${workId}.json`);
    const searchInfo = await axios.get(`https://openlibrary.org/search.json?q=${workId}`)
    const bookReviews = await Review.find({bookId :{$in: workId}}).populate('user');
    const bookInfo = searchInfo.data.docs[0];
    const bookWorkInfo = workInfo.data;
    req.session.returnTo = req.originalUrl;
    res.render('bookworm/viewBook', {bookInfo, bookWorkInfo, bookReviews});
})

app.get('/bookworm/view/authors/:authorId', async (req, res) => {
    const {authorId} = req.params;
    const authorSearchInfo = await axios.get(`https://openlibrary.org/authors/${authorId}.json`);
    const authorInfo = authorSearchInfo.data;
    req.session.returnTo = req.originalUrl;
    res.render('bookworm/viewAuthor', {authorInfo});
})

app.get('/bookworm/register', (req, res)=>{
    res.render('user/register')
})

app.post('/bookworm/register', async (req, res)=>{
    try{
        const {username, email, password} = req.body;
        const user = new User({email, username});
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err =>{
            if(err) return next(err);
            req.flash('success','Welcome to Bookworm!')
            res.redirect('/')
        })
    }
    catch(err){
        req.flash('error',err.message);
        res.redirect('/bookworm/register');
    }

})



app.get('/bookworm/login', (req, res)=>{
    res.render('user/login')
})


app.post('/bookworm/login',passport.authenticate('local', {failureFlash: true, failureRedirect:'/bookworm/login'}), async (req, res)=>{
    req.flash('success','Succesfully Logged In!');
    const redirectedUrl = req.session.returnTo || '/bookworm';
    delete req.session.returnTo;
    res.redirect('/');
})


app.get('/bookworm/logout', (req, res)=>{
    req.logOut();
    req.flash('success', 'Succesfully Logged Out!');
    res.redirect('/');
})


app.post('/bookworm/postReviews/:bookId', isLoggedIn, async (req, res) =>{
    const {rating, description} = req.body;
    const {bookId} = req.params;
    const review = new Review({rating, description,bookId});
    review.user = req.user._id;
    const user = await User.findById(req.user._id);
    user.reviews.push(review);
    await user.save();
    await review.save();
    req.flash('success','Successfully Added your review!');
    res.redirect(`/bookworm/view/book/${bookId}`);
})

app.post('/bookworm/:bookId/deleteReview/:reviewId', isLoggedIn, async (req, res) => {
    const {bookId, reviewId} = req.params;
    await User.findByIdAndUpdate(req.user._id, {$pull: {reviews:reviewId}});
    await Review.findByIdAndDelete(reviewId);
    req.flash('success','Successfully Deleted your review!');
    res.redirect(`/bookworm/view/book/${bookId}`);
})

app.post('/bookworm/reviews/:bookId', isLoggedIn, async (req, res) =>{
    const {rating, description} = req.body;
    const {bookId} = req.params;
    const review = new Review({rating, description,bookId});
    review.user = req.user._id;
    const user = await User.findById(req.user._id);
    user.reviews.push(review);
    await user.save();
    await review.save();
    req.flash('success','Successfully Added your review!');
    res.redirect(`/bookworm/view/book/${bookId}`);
})


app.get('/bookworm/myFavourites', isLoggedIn, async (req, res) =>{
    req.session.returnTo = req.originalUrl;
    const myFavourites = await Favourite.find({user:req.user._id});
    res.render('bookworm/favourites', {myFavourites});
})

app.post('/bookworm/addFavourite/:bookId', isLoggedIn,  async (req, res) =>{
    const {bookId} = req.params;
    const user = await User.findById(req.user._id);
    if(user.favourites.includes(bookId)){
        req.flash('error','The book is already in your favourites');
    }
    else{
        const searchInfo = await axios.get(`https://openlibrary.org/search.json?q=${bookId}`);
        const bookInfo = searchInfo.data.docs[0];

        const favourite = new Favourite({
                    bookId, 
                    user:req.user._id,
                    title: bookInfo.title, 
                    imageUrl:bookInfo.cover_i, 
                    authorId:bookInfo.author_key[0], 
                    authorName: bookInfo.author_name[0]
                })
        user.favourites.push(bookId);
        await user.save();
        await favourite.save();
        req.flash('success','Succesfully added book to your Favourites!');
    }

    const redirectedUrl = req.session.returnTo;
    delete req.session.returnTo;
    res.redirect(redirectedUrl);
})

app.post('/bookworm/deleteFavourite/:bookId', isLoggedIn, async (req, res)=>{
    const {bookId} = req.params; 
    const user = await User.findById(req.user._id);
    const index = user.favourites.indexOf(bookId);

    if (index > -1) {
        user.favourites.splice(index, 1);
        await Favourite.deleteOne({bookId})
        await user.save();
        req.flash('success','Succesfully removed book from your favourites')
    }
    else{
        req.flash('error',"Couldn't delete book from your favourites")
    }
    const redirectedUrl = req.session.returnTo;
    delete req.session.returnTo;
    res.redirect(redirectedUrl);
})

app.all('*', (req, res, next) =>{
    next(new ExpressError('Page Not Found', 404));
});

app.use((err, req, res, next)=>{
    const { statusCode = 500 } = err;
    if(!err.message) err.message = "Something Went Wrong";
    res.status(statusCode).render('error', { err });
});

const port = process.env.PORT || 3000;

app.listen(port, ()=>{
    console.log(`Listening on port ${port}`);
});

