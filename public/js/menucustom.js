$(document).ready(function () {
  // Menu
    $("#sub-menu").click(function (event) {
        event.preventDefault();
        if ($(".sub-menu").hasClass("close")) {
            $(".sub-menu").removeClass("close");
            $(".sub-menu").addClass("open");
        }
        else {
            $(".sub-menu").removeClass("open");
            $(".sub-menu").addClass("close");
        }
    });

    //Sub menu in menu2
    $(".has-custom-sub").click(function (event) {
        if ($(this).find("ul").hasClass("custom-sub-close")) {
            $(this).find("ul").removeClass("custom-sub-close");
            $(this).find("ul").addClass("custom-sub-open");
        }
        else {
            $(this).find("ul").removeClass("custom-sub-open");
            $(this).find("ul").addClass("custom-sub-close");
        }
    });

    //Closing menu when focus is lost
    $('html').click(function (e) {
        if ((e.target.id != 'sub-menu' && $(e.target).parents('#sub-menu').length == 0) && (e.target.id != 'admin-menu' && $(e.target).parents('#admin-menu').length == 0)) {
            $(".sub-menu").removeClass("open");
            $(".sub-menu").addClass("close");
        }
    });

    //Search feature 
    $("#target").keyup(function (index) {
        var target = $(this).val(), count = 0;
        $(".sub-menu a").each(function () {
            if ($(this).html().search(new RegExp(target, "i")) < 0) {
                $(this).hide();

                // Show the list item if the phrase matches and increase the count by 1
            } else {
                $(this).show();
                count++;
            }
        });
    });
});