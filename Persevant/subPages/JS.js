window.addEventListener('scroll', function() {
    var containerHeight = document.documentElement.scrollHeight - window.innerHeight;
    var image = document.querySelector('.boarderLeft img');
    var imageHeight = image.offsetHeight;
  
    var scrollPercentage = (window.scrollY / containerHeight) * 100;
    var scrollingRate = (imageHeight - window.innerHeight) / containerHeight;
  
    var adjustedScrollingRate = scrollingRate * (imageHeight / containerHeight);
  
    var boarderLeftImg = document.querySelector('.boarderLeft img');
    var boarderrightImg = document.querySelector('.boarderright img');
  
    boarderLeftImg.style.transform = 'translateY(' + (-scrollPercentage * adjustedScrollingRate) + 'px)';
    boarderrightImg.style.transform = 'translateY(' + (-scrollPercentage * adjustedScrollingRate) + 'px)';
  });