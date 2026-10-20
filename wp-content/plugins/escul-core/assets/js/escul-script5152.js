jQuery(document).ready(function($) {
    $('body').on('click', '.escul-remove', function(e) {
        e.preventDefault();
        var $this = $(this);
        var product_id = $this.data('product_id');
        var cart_item_key = $this.data('cart_item_key');

        $.ajax({
            type: 'POST',
            url: escul_ajax_obj.ajax_url,
            data: {
                action: 'product_remove',
                product_id: product_id,
                cart_item_key: cart_item_key,
                nonce: escul_ajax_obj.nonce
            },
            success: function(response) {
                if (response.fragments) {
                    $.each(response.fragments, function(key, value) {
                        $(key).replaceWith(value);
                    });
                }
            }
        });
    });
});
